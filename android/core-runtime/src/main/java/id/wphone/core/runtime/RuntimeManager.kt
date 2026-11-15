package id.wphone.core.runtime

import android.app.ActivityManager
import android.content.Context
import android.net.Uri
import android.os.StatFs
import android.system.Os
import id.wphone.core.config.AudioBackend
import id.wphone.core.config.DeviceCapabilities
import id.wphone.core.config.GraphicsBackend
import id.wphone.core.config.WindowsAppConfig
import org.apache.commons.compress.archivers.tar.TarArchiveEntry
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import org.tukaani.xz.XZInputStream
import java.io.BufferedInputStream
import java.io.BufferedReader
import java.io.File
import java.io.InputStream
import java.io.InputStreamReader
import java.io.RandomAccessFile
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.CopyOnWriteArrayList
import java.util.zip.ZipInputStream

data class RuntimeInstallProgress(
    val phase: String,
    val bytesProcessed: Long,
    val totalBytes: Long,
    val currentFile: String
)

data class RuntimeInstallStatus(
    val isInstalled: Boolean,
    val hasBundledAsset: Boolean,
    val hasProotBinary: Boolean,
    val hasWineBinary: Boolean,
    val hasBox64Binary: Boolean,
    val bundleSummary: String
)

data class LiveSystemTelemetry(
    val cpuPercent: Int,
    val ramUsedMb: Long,
    val ramTotalMb: Long,
    val ramFreeMb: Long,
    val storageFreeGb: Double,
    val storageTotalGb: Double
)

object SystemTelemetryReader {
    private var prevIdle = -1L
    private var prevTotal = -1L

    fun read(context: Context): LiveSystemTelemetry {
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val mi = ActivityManager.MemoryInfo()
        am.getMemoryInfo(mi)
        val totalRamMb = (mi.totalMem / (1024L * 1024L)).coerceAtLeast(1L)
        val availRamMb = (mi.availMem / (1024L * 1024L)).coerceIn(0L, totalRamMb)
        val usedRamMb = (totalRamMb - availRamMb).coerceAtLeast(0L)

        val stat = StatFs(context.filesDir.absolutePath)
        val freeGb = (stat.availableBlocksLong * stat.blockSizeLong) / (1024.0 * 1024.0 * 1024.0)
        val totalGb = (stat.blockCountLong * stat.blockSizeLong) / (1024.0 * 1024.0 * 1024.0)

        val cpuPercent = sampleCpuPercent()
        return LiveSystemTelemetry(
            cpuPercent = cpuPercent,
            ramUsedMb = usedRamMb,
            ramTotalMb = totalRamMb,
            ramFreeMb = availRamMb,
            storageFreeGb = freeGb,
            storageTotalGb = totalGb
        )
    }

    private fun sampleCpuPercent(): Int {
        return runCatching {
            val line = File("/proc/stat").bufferedReader().use { it.readLine() } ?: return 0
            val parts = line.trim().split(Regex("\\s+"))
            if (parts.size < 5) return 0
            val user = parts[1].toLongOrNull() ?: 0L
            val nice = parts[2].toLongOrNull() ?: 0L
            val sys = parts[3].toLongOrNull() ?: 0L
            val idle = parts[4].toLongOrNull() ?: 0L
            val iowait = parts.getOrNull(5)?.toLongOrNull() ?: 0L
            val irq = parts.getOrNull(6)?.toLongOrNull() ?: 0L
            val softirq = parts.getOrNull(7)?.toLongOrNull() ?: 0L
            val total = user + nice + sys + idle + iowait + irq + softirq

            if (prevTotal < 0L) {
                prevTotal = total
                prevIdle = idle
                return ((1.0 - (idle.toDouble() / total.coerceAtLeast(1L))) * 100.0).toInt().coerceIn(2, 100)
            }
            val diffTotal = (total - prevTotal).coerceAtLeast(1L)
            val diffIdle = (idle - prevIdle).coerceAtLeast(0L)
            prevTotal = total
            prevIdle = idle
            (((diffTotal - diffIdle).toDouble() / diffTotal.toDouble()) * 100.0).toInt().coerceIn(0, 100)
        }.getOrDefault(12)
    }
}

class RuntimeManager(private val wphoneRoot: File) {

    fun runtimeDir(): File = File(wphoneRoot, "runtime").apply { mkdirs() }
    fun rootfsDir(): File = File(wphoneRoot, "rootfs").apply { mkdirs() }
    fun tmpDir(): File = File(wphoneRoot, "tmp").apply { mkdirs() }

    private fun markerFile(): File = File(runtimeDir(), ".extracted_ok")

    fun inspectStatus(context: Context): RuntimeInstallStatus {
        val prootFile = File(context.applicationInfo.nativeLibraryDir, "libproot.so")
        val wineBin = resolveWineBinary()
        val box64Bin = File(rootfsDir(), "usr/local/bin/box64")
        val hasAsset = runCatching {
            context.assets.list("runtime")?.contains("wphone-rootfs-arm64.tar.xz") == true
        }.getOrDefault(false)

        val manifestText = runCatching {
            context.assets.open("runtime/runtime-manifest.json").bufferedReader().use { it.readText() }
        }.getOrNull() ?: if (!hasAsset) {
            "Dev build without bundled runtime asset (requires CI build or custom .tar.xz import)"
        } else {
            "Bundled ARM64 runtime ready in APK assets"
        }

        val installed = markerFile().exists() && prootFile.exists() && wineBin.exists() && box64Bin.exists()
        return RuntimeInstallStatus(
            isInstalled = installed,
            hasBundledAsset = hasAsset,
            hasProotBinary = prootFile.exists(),
            hasWineBinary = wineBin.exists(),
            hasBox64Binary = box64Bin.exists(),
            bundleSummary = manifestText
        )
    }

    fun resolveWineBinary(): File {
        val candidates = listOf(
            File(rootfsDir(), "opt/wine/bin/wine64"),
            File(rootfsDir(), "opt/wine/bin/wine"),
            File(rootfsDir(), "usr/bin/wine")
        )
        return candidates.firstOrNull { it.exists() } ?: candidates.first()
    }

    fun extractBundledRuntime(
        context: Context,
        onProgress: (RuntimeInstallProgress) -> Unit
    ): Result<Unit> = runCatching {
        val assetPath = "runtime/wphone-rootfs-arm64.tar.xz"
        val totalCompressed = runCatching {
            context.assets.openFd(assetPath).use { it.length }
        }.getOrDefault(-1L)

        context.assets.open(assetPath).use { rawStream ->
            extractTarXzStream(rawStream, totalCompressed, onProgress)
        }
    }

    fun extractCustomTarXzUri(
        context: Context,
        uri: Uri,
        onProgress: (RuntimeInstallProgress) -> Unit
    ): Result<Unit> = runCatching {
        val stream = context.contentResolver.openInputStream(uri)
            ?: error("Cannot open selected runtime archive")
        stream.use { rawStream ->
            extractTarXzStream(rawStream, -1L, onProgress)
        }
    }

    private fun extractTarXzStream(
        rawStream: InputStream,
        totalCompressedBytes: Long,
        onProgress: (RuntimeInstallProgress) -> Unit
    ) {
        val destRoot = rootfsDir()
        if (destRoot.exists()) {
            onProgress(RuntimeInstallProgress("Preparing clean rootfs directory...", 0L, totalCompressedBytes, ""))
            destRoot.deleteRecursively()
        }
        destRoot.mkdirs()
        File(tmpDir(), ".X11-unix").mkdirs()

        val rootCanonical = destRoot.canonicalPath
        var bytesReadCount = 0L
        val countingIn = object : InputStream() {
            override fun read(): Int {
                val b = rawStream.read()
                if (b >= 0) bytesReadCount++
                return b
            }
            override fun read(b: ByteArray, off: Int, len: Int): Int {
                val n = rawStream.read(b, off, len)
                if (n > 0) bytesReadCount += n
                return n
            }
        }

        val deferredHardLinks = mutableListOf<Pair<File, File>>()
        val buf = ByteArray(64 * 1024)
        var lastReportMs = 0L

        BufferedInputStream(countingIn, 64 * 1024).use { bis ->
            XZInputStream(bis).use { xzIn ->
                TarArchiveInputStream(xzIn).use { tarIn ->
                    var entry: TarArchiveEntry? = tarIn.nextEntry
                    while (entry != null) {
                        val relName = entry.name.trimStart('.', '/')
                        if (relName.isNotEmpty()) {
                            val outFile = File(destRoot, relName)
                            if (!outFile.canonicalPath.startsWith(rootCanonical + File.separator) &&
                                outFile.canonicalPath != rootCanonical
                            ) {
                                throw SecurityException("Blocked unsafe tar entry: ${entry.name}")
                            }

                            when {
                                entry.isDirectory -> {
                                    outFile.mkdirs()
                                }
                                entry.isSymbolicLink -> {
                                    outFile.parentFile?.mkdirs()
                                    if (outFile.exists()) outFile.delete()
                                    runCatching { Os.symlink(entry.linkName, outFile.absolutePath) }
                                }
                                entry.isLink -> {
                                    val target = File(destRoot, entry.linkName.trimStart('.', '/'))
                                    deferredHardLinks += outFile to target
                                }
                                else -> {
                                    outFile.parentFile?.mkdirs()
                                    outFile.outputStream().use { out ->
                                        while (true) {
                                            val n = tarIn.read(buf)
                                            if (n <= 0) break
                                            out.write(buf, 0, n)
                                        }
                                    }
                                    if ((entry.mode and 0b001_001_001) != 0) {
                                        outFile.setExecutable(true, false)
                                    }
                                }
                            }

                            val now = System.currentTimeMillis()
                            if (now - lastReportMs > 180L) {
                                lastReportMs = now
                                onProgress(
                                    RuntimeInstallProgress(
                                        phase = "Extracting Wine WoW64 + Box64 rootfs",
                                        bytesProcessed = bytesReadCount,
                                        totalBytes = totalCompressedBytes,
                                        currentFile = relName
                                    )
                                )
                            }
                        }
                        entry = tarIn.nextEntry
                    }
                }
            }
        }

        deferredHardLinks.forEach { (linkFile, targetFile) ->
            linkFile.parentFile?.mkdirs()
            if (targetFile.exists()) {
                runCatching { Os.link(targetFile.absolutePath, linkFile.absolutePath) }
                    .onFailure { targetFile.copyTo(linkFile, overwrite = true) }
            }
        }

        File(destRoot, "tmp/.X11-unix").mkdirs()
        File(destRoot, "opt/wphone_prefixes").mkdirs()
        File(destRoot, "root").mkdirs()
        markerFile().writeText("installedAt=${System.currentTimeMillis()}\n")
        onProgress(
            RuntimeInstallProgress(
                phase = "Environment ready",
                bytesProcessed = bytesReadCount,
                totalBytes = if (totalCompressedBytes > 0) totalCompressedBytes else bytesReadCount,
                currentFile = "Done"
            )
        )
    }

    fun downloadNotepadPlusPlusPortable(
        prefixesDir: File,
        onProgress: (downloadedBytes: Long, totalBytes: Long) -> Unit
    ): Result<File> = runCatching {
        val apiConn = (URL("https://api.github.com/repos/notepad-plus-plus/notepad-plus-plus/releases/latest")
            .openConnection() as HttpURLConnection).apply {
            setRequestProperty("Accept", "application/vnd.github+json")
            setRequestProperty("User-Agent", "WPhone-Android/1.2")
            connectTimeout = 15_000
            readTimeout = 20_000
        }
        val releaseJson = apiConn.inputStream.bufferedReader().use { it.readText() }
        val urlRegex = Regex("""https://[^"]*portable\.x64\.zip""")
        val downloadUrl = urlRegex.find(releaseJson)?.value
            ?: error("Could not resolve official Notepad++ portable x64 ZIP URL.")

        val importsDir = File(wphoneRoot, "imports").apply { mkdirs() }
        val zipFile = File(importsDir, "npp-portable-x64.zip")

        val dlConn = (URL(downloadUrl).openConnection() as HttpURLConnection).apply {
            setRequestProperty("User-Agent", "WPhone-Android/1.2")
            connectTimeout = 15_000
            readTimeout = 30_000
        }
        val total = dlConn.contentLengthLong.coerceAtLeast(0L)
        var copied = 0L
        val buf = ByteArray(16 * 1024)
        dlConn.inputStream.use { input ->
            zipFile.outputStream().use { out ->
                while (true) {
                    val n = input.read(buf)
                    if (n <= 0) break
                    out.write(buf, 0, n)
                    copied += n
                    onProgress(copied, total)
                }
            }
        }

        val targetDir = File(prefixesDir, "pfx-notepadpp/drive_c/Program Files/Notepad++").apply { mkdirs() }
        val targetCanonical = targetDir.canonicalPath
        ZipInputStream(zipFile.inputStream().buffered()).use { zis ->
            var entry = zis.nextEntry
            while (entry != null) {
                val outFile = File(targetDir, entry.name)
                if (!outFile.canonicalPath.startsWith(targetCanonical + File.separator)) {
                    throw SecurityException("Zip Slip blocked for ${entry.name}")
                }
                if (entry.isDirectory) {
                    outFile.mkdirs()
                } else {
                    outFile.parentFile?.mkdirs()
                    outFile.outputStream().use { zis.copyTo(it) }
                }
                entry = zis.nextEntry
            }
        }

        val exeFile = File(targetDir, "notepad++.exe")
        if (!exeFile.exists()) error("Extracted archive did not contain notepad++.exe")
        exeFile
    }

    fun downloadResumable(
        urlString: String,
        destFile: File,
        expectedSha256: String,
        onProgress: (downloadedBytes: Long, totalBytes: Long) -> Unit
    ): Boolean {
        val existingBytes = if (destFile.exists()) destFile.length() else 0L
        val conn = (URL(urlString).openConnection() as HttpURLConnection).apply {
            if (existingBytes > 0L) setRequestProperty("Range", "bytes=$existingBytes-")
            connectTimeout = 15_000
            readTimeout = 30_000
        }

        val responseCode = conn.responseCode
        val append = responseCode == HttpURLConnection.HTTP_PARTIAL
        val total = existingBytes + conn.contentLengthLong.coerceAtLeast(0L)

        RandomAccessFile(destFile, "rw").use { raf ->
            if (append) raf.seek(existingBytes) else raf.setLength(0L)
            conn.inputStream.use { input ->
                val buf = ByteArray(16 * 1024)
                var copied = if (append) existingBytes else 0L
                while (true) {
                    val n = input.read(buf)
                    if (n == -1) break
                    raf.write(buf, 0, n)
                    copied += n
                    onProgress(copied, total)
                }
            }
        }

        return verifySha256(destFile, expectedSha256)
    }

    fun verifySha256(file: File, expectedHex: String): Boolean {
        val md = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buf = ByteArray(8192)
            while (true) {
                val n = input.read(buf)
                if (n == -1) break
                md.update(buf, 0, n)
            }
        }
        val actual = md.digest().joinToString("") { "%02x".format(it) }
        return actual.equals(expectedHex, ignoreCase = true)
    }
}

class WineWoW64Launcher(
    private val runtimeDir: File,
    private val prefixesDir: File
) {
    fun buildEnvironment(
        app: WindowsAppConfig,
        caps: DeviceCapabilities? = null,
        registryOverrides: String = "",
        globalSafeMode: Boolean = false
    ): Map<String, String> {
        val budget = caps?.memoryBudget
        val safeDynarec = globalSafeMode || app.box64SafeMode

        val env = linkedMapOf(
            "WINEPREFIX" to "/opt/wphone_prefixes/${app.prefixId}",
            "WINESERVER" to "/opt/wine/bin/wineserver",
            "WINEARCH" to if (app.arch.name == "X86") "win32" else "win64",
            "WINEESYNC" to "0",
            "WINEMSYNC" to "0",
            "WINEDEBUG" to "-all,err+module",
            // Prevent Ubuntu 24.04 glibc 2.39 rseq SIGSEGV (exit 139) on older Android kernels
            "GLIBC_TUNABLES" to "glibc.pthread.rseq=0",
            "BOX64_LOG" to "1",
            "BOX64_NOBANNER" to "0",
            "BOX64_MMAP32" to "1",
            "BOX64_DYNAREC" to if (safeDynarec) "0" else "1",
            "BOX64_DYNAREC_SAFEFLAGS" to "1",
            "BOX64_DYNAREC_STRONGMEM" to "1",
            "BOX64_DYNAREC_BIGBLOCK" to if (safeDynarec) "0" else (budget?.box64BigBlock?.toString() ?: "1"),
            "BOX64_LD_LIBRARY_PATH" to "/opt/wine/lib:/opt/wine/lib/wine/x86_64-unix:/usr/lib/x86_64-linux-gnu",
            "LD_LIBRARY_PATH" to "/opt/wine/lib:/opt/wine/lib/wine/aarch64-unix:/usr/lib/aarch64-linux-gnu:/lib/aarch64-linux-gnu",
            "PULSE_SERVER" to "unix:/tmp/pulse.sock",
            "PULSE_LATENCY_MSEC" to if (app.audioBackend == AudioBackend.PULSE_OPENSL_ES) "60" else "30",
            "DISPLAY" to ":0",
            "XDG_RUNTIME_DIR" to "/tmp",
            "HOME" to "/root",
            "USER" to "root"
        )

        val baseOverrides = mutableListOf("winemenubuilder.exe=d")
        when (app.graphicsBackend) {
            GraphicsBackend.TURNIP_DXVK -> {
                env["VK_ICD_FILENAMES"] = "/opt/wphone_runtime/turnip_icd.json"
                baseOverrides += "d3d9,d3d10core,d3d11,dxgi=n,b"
            }
            GraphicsBackend.SYSTEM_VULKAN_DXVK -> {
                baseOverrides += "d3d9,d3d10core,d3d11,dxgi=n,b"
            }
            GraphicsBackend.VKD3D_PROTON -> {
                baseOverrides += "d3d12,d3d12core=n,b"
            }
            GraphicsBackend.WINED3D_VIRGL -> {
                env["LIBGL_ALWAYS_SOFTWARE"] = "0"
                env["MESA_GL_VERSION_OVERRIDE"] = "3.3"
            }
        }

        if (registryOverrides.isNotBlank()) {
            baseOverrides += registryOverrides
        }
        if (baseOverrides.isNotEmpty()) {
            env["WINEDLLOVERRIDES"] = baseOverrides.joinToString(";")
        }

        env.putAll(app.envVars)
        return env
    }

    fun buildCommandLine(
        app: WindowsAppConfig,
        virtualDesktopSize: String = "1280x720",
        wineGuestBin: String = "/opt/wine/bin/wine"
    ): List<String> {
        val escapedExe = app.executablePath.replace("\"", "\\\"")
        val argsPart = if (app.arguments.isNotBlank()) " ${app.arguments}" else ""
        // Wait briefly for X11 unix socket, pre-warm Wine prefix system hives if missing, then launch target
        val script = buildString {
            append("i=0; while [ ! -S /tmp/.X11-unix/X0 ] && [ \$i -lt 25 ]; do sleep 0.1; i=\$((i+1)); done; ")
            append("if [ ! -f \"\$WINEPREFIX/system.reg\" ]; then /usr/local/bin/box64 $wineGuestBin wineboot --init || true; fi; ")
            if (app.id == "wine-notepad") {
                append("exec /usr/local/bin/box64 $wineGuestBin explorer /desktop=WPhone,$virtualDesktopSize notepad.exe$argsPart")
            } else {
                append("exec /usr/local/bin/box64 $wineGuestBin explorer /desktop=WPhone,$virtualDesktopSize \"$escapedExe\"$argsPart")
            }
        }
        return listOf("/bin/sh", "-c", script)
    }
}

class WineProcessRunner(
    private val context: Context,
    private val runtimeManager: RuntimeManager,
    private val prefixesDir: File
) {
    private var activeProcess: Process? = null
    val logs = CopyOnWriteArrayList<String>()

    fun isRunning(): Boolean = activeProcess?.isAlive == true

    fun start(
        app: WindowsAppConfig,
        caps: DeviceCapabilities?,
        registryOverrides: String,
        fbWidth: Int,
        fbHeight: Int,
        globalSafeMode: Boolean = false,
        onLogLine: (String) -> Unit,
        onExit: (Int) -> Unit
    ): Result<Unit> = runCatching {
        stop()
        val nativeLibDir = context.applicationInfo.nativeLibraryDir
        val prootBin = File(nativeLibDir, "libproot.so")
        if (!prootBin.exists()) {
            error("libproot.so missing in nativeLibraryDir. Build APK with bundled runtime.")
        }
        val rootfs = runtimeManager.rootfsDir()
        val tmpDir = runtimeManager.tmpDir().apply {
            mkdirs()
            File(this, ".X11-unix").mkdirs()
        }
        val wineBin = runtimeManager.resolveWineBinary()
        val box64Bin = File(rootfs, "usr/local/bin/box64")
        if (!wineBin.exists() || !box64Bin.exists()) {
            error("Wine/Box64 runtime not extracted yet. Run Setup Wizard first.")
        }

        val wphoneRoot = prefixesDir.parentFile ?: prefixesDir
        val launcher = WineWoW64Launcher(runtimeManager.runtimeDir(), prefixesDir)
        val wineEnv = launcher.buildEnvironment(app, caps, registryOverrides, globalSafeMode)
        val guestCmd = launcher.buildCommandLine(
            app = app,
            virtualDesktopSize = "${fbWidth}x${fbHeight}",
            wineGuestBin = "/opt/wine/bin/${wineBin.name}"
        )

        val prootArgs = mutableListOf(
            prootBin.absolutePath,
            "-k", "5.15.0",
            "-r", rootfs.absolutePath,
            "-0",
            "-w", "/root",
            "--link2symlink",
            "-b", "/dev",
            "-b", "/dev/urandom:/dev/urandom",
            "-b", "/dev/null:/dev/null",
            "-b", "/dev/zero:/dev/zero",
            "-b", "/proc",
            "-b", "/sys",
            "-b", "${tmpDir.absolutePath}:/tmp",
            "-b", "${prefixesDir.absolutePath}:/opt/wphone_prefixes",
            "-b", "${wphoneRoot.absolutePath}:${wphoneRoot.absolutePath}"
        )
        prootArgs += guestCmd

        val pb = ProcessBuilder(prootArgs)
        pb.redirectErrorStream(true)
        val env = pb.environment()
        env["LD_LIBRARY_PATH"] = nativeLibDir
        env["PROOT_TMP_DIR"] = tmpDir.absolutePath
        env["PROOT_NO_SECCOMP"] = "1"
        val loader = File(nativeLibDir, "libproot-loader.so")
        if (loader.exists()) env["PROOT_LOADER"] = loader.absolutePath
        val loader32 = File(nativeLibDir, "libproot-loader32.so")
        if (loader32.exists()) env["PROOT_LOADER_32"] = loader32.absolutePath
        env["PATH"] = "/opt/wine/bin:/usr/local/bin:/usr/bin:/bin"
        env.putAll(wineEnv)

        val safeLabel = if (globalSafeMode || app.box64SafeMode) " [Box64 SAFE MODE: Dynarec OFF]" else ""
        appendLog("[wphone] Starting PRoot (-k 5.15.0, rseq=0) -> Box64 -> Wine WoW64$safeLabel: ${app.executablePath}", onLogLine)
        val proc = pb.start()
        activeProcess = proc

        Thread({
            runCatching {
                BufferedReader(InputStreamReader(proc.inputStream)).use { reader ->
                    var line: String? = reader.readLine()
                    while (line != null) {
                        appendLog(line, onLogLine)
                        line = reader.readLine()
                    }
                }
            }
            val code = runCatching { proc.waitFor() }.getOrDefault(-1)
            appendLog("[wphone] Process exited with code $code", onLogLine)
            onExit(code)
        }, "WPhone-Process-Reader").apply {
            isDaemon = true
            start()
        }
    }

    private fun appendLog(line: String, onLogLine: (String) -> Unit) {
        if (logs.size >= 400) {
            runCatching { logs.removeAt(0) }
        }
        logs.add(line)
        onLogLine(line)
    }

    fun stop() {
        val proc = activeProcess ?: return
        activeProcess = null
        runCatching { proc.destroy() }
        runCatching {
            if (proc.isAlive) proc.destroyForcibly()
        }
    }
}

class AdminShellRunner(
    private val context: Context,
    private val runtimeManager: RuntimeManager,
    private val prefixesDir: File
) {
    fun execute(command: String): Pair<Int, String> = runCatching {
        val nativeLibDir = context.applicationInfo.nativeLibraryDir
        val prootBin = File(nativeLibDir, "libproot.so")
        val rootfs = runtimeManager.rootfsDir()
        val tmpDir = runtimeManager.tmpDir().apply { mkdirs() }
        val wphoneRoot = prefixesDir.parentFile ?: prefixesDir

        if (!prootBin.exists() || !rootfs.exists()) {
            return@runCatching -1 to "[error] PRoot or rootfs not installed yet. Run Setup Wizard or Extract Runtime first."
        }

        val args = listOf(
            prootBin.absolutePath,
            "-k", "5.15.0",
            "-r", rootfs.absolutePath,
            "-0",
            "-w", "/root",
            "--link2symlink",
            "-b", "/dev",
            "-b", "/proc",
            "-b", "/sys",
            "-b", "${tmpDir.absolutePath}:/tmp",
            "-b", "${prefixesDir.absolutePath}:/opt/wphone_prefixes",
            "-b", "${wphoneRoot.absolutePath}:${wphoneRoot.absolutePath}",
            "/bin/sh", "-c", command
        )

        val pb = ProcessBuilder(args)
        pb.redirectErrorStream(true)
        val env = pb.environment()
        env["LD_LIBRARY_PATH"] = nativeLibDir
        env["PROOT_TMP_DIR"] = tmpDir.absolutePath
        env["PROOT_NO_SECCOMP"] = "1"
        val loader = File(nativeLibDir, "libproot-loader.so")
        if (loader.exists()) env["PROOT_LOADER"] = loader.absolutePath
        val loader32 = File(nativeLibDir, "libproot-loader32.so")
        if (loader32.exists()) env["PROOT_LOADER_32"] = loader32.absolutePath
        env["PATH"] = "/opt/wine/bin:/usr/local/bin:/usr/bin:/bin"
        env["HOME"] = "/root"
        env["GLIBC_TUNABLES"] = "glibc.pthread.rseq=0"
        env["BOX64_MMAP32"] = "1"

        val proc = pb.start()
        val output = BufferedReader(InputStreamReader(proc.inputStream)).use { it.readText() }
        val code = proc.waitFor()
        code to output.ifBlank { "(exit $code, no stdout/stderr)" }
    }.getOrElse { err ->
        -1 to "[exception] ${err.message}"
    }
}
