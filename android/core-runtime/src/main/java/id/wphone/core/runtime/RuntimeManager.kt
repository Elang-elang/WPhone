package id.wphone.core.runtime

import id.wphone.core.config.AudioBackend
import id.wphone.core.config.DeviceCapabilities
import id.wphone.core.config.GraphicsBackend
import id.wphone.core.config.WindowsAppConfig
import java.io.File
import java.io.RandomAccessFile
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

class RuntimeManager(private val wphoneRoot: File) {

    fun runtimeDir(): File = File(wphoneRoot, "runtime").apply { mkdirs() }

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
        registryOverrides: String = ""
    ): Map<String, String> {
        val budget = caps?.memoryBudget
        val useLegacyBudget = budget?.isSubAndroid10 == true || budget?.isLowRamMode == true

        val env = linkedMapOf(
            "WINEPREFIX" to File(prefixesDir, app.prefixId).absolutePath,
            "WINEESYNC" to if (budget?.enableEsync == false) "0" else "1",
            "WINEDEBUG" to "-all",
            "BOX64_LOG" to "0",
            "BOX64_DYNAREC_BIGBLOCK" to (budget?.box64BigBlock?.toString() ?: "1"),
            "BOX64_DYNAREC_STRONGMEM" to if (useLegacyBudget) "0" else "1",
            "PULSE_SERVER" to "unix:${runtimeDir.absolutePath}/pulse.sock",
            "PULSE_LATENCY_MSEC" to if (app.audioBackend == AudioBackend.PULSE_OPENSL_ES) "60" else "30",
            "DISPLAY" to ":0"
        )

        if (budget?.box64Mmap32 == true) {
            env["BOX64_MMAP32"] = "1"
        }

        val baseOverrides = mutableListOf<String>()
        when (app.graphicsBackend) {
            GraphicsBackend.TURNIP_DXVK -> {
                env["VK_ICD_FILENAMES"] = "${runtimeDir.absolutePath}/turnip_icd.json"
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

    fun buildCommandLine(app: WindowsAppConfig): List<String> {
        val box64Bin = File(runtimeDir, "box64").absolutePath
        val wineBin = File(runtimeDir, "wine-wow64/bin/wine64").absolutePath
        val cmd = mutableListOf(box64Bin, wineBin, app.executablePath)
        if (app.arguments.isNotBlank()) {
            cmd += app.arguments.split(" ").filter { it.isNotBlank() }
        }
        return cmd
    }
}
