package id.wphone

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Apps
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Extension
import androidx.compose.material.icons.filled.Keyboard
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import id.wphone.core.config.DeviceCapabilities
import id.wphone.core.config.EasyProfile
import id.wphone.core.config.WindowsAppConfig
import id.wphone.core.input.DesktopModifierBar
import id.wphone.core.input.GamingVirtualPadBar
import id.wphone.core.plugin.InstalledPluginState
import id.wphone.core.prefix.DllOverrideMode
import id.wphone.core.prefix.WineRegistryHive
import id.wphone.core.runtime.RuntimeInstallProgress
import id.wphone.core.runtime.RuntimeInstallStatus
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val app = application as WPhoneApplication
        val caps = app.deviceAnalyzer.analyze()

        setContent {
            val isDark = androidx.compose.foundation.isSystemInDarkTheme()
            val scheme = if (isDark) {
                darkColorScheme(primary = Color(0xFF38BDF8), background = Color(0xFF0B1120))
            } else {
                lightColorScheme(primary = Color(0xFF0078D4), background = Color(0xFFF8FAFC))
            }

            MaterialTheme(colorScheme = scheme) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    WPhoneOfficialShell(app = app, caps = caps)
                }
            }
        }
    }
}

@Composable
private fun WPhoneOfficialShell(app: WPhoneApplication, caps: DeviceCapabilities) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var appState by remember { mutableStateOf(app.repository.loadState(caps)) }
    var runtimeStatus by remember { mutableStateOf(app.runtimeManager.inspectStatus(context)) }
    var plugins by remember { mutableStateOf(app.pluginManager.listInstalled()) }
    var selectedTab by remember { mutableIntStateOf(0) }
    var statusBanner by remember { mutableStateOf<String?>(null) }

    var isExtracting by remember { mutableStateOf(false) }
    var installProgress by remember { mutableStateOf<RuntimeInstallProgress?>(null) }
    var nppDownloading by remember { mutableStateOf(false) }
    var nppProgressText by remember { mutableStateOf<String?>(null) }

    val exePicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        if (uri != null) {
            runCatching {
                val (file, name) = app.repository.copyUriToImports(uri)
                val (nextState, pe) = app.repository.registerWindowsBinary(file, name, caps, appState)
                appState = nextState
                statusBanner = "${pe.arch?.name ?: "Unknown"} PE verified (${pe.subsystem}) · SHA-256 ${pe.sha256.take(12)}"
            }.onFailure { err ->
                statusBanner = "Import failed: ${err.message}"
            }
        }
    }

    val pluginPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        if (uri != null) {
            runCatching {
                val (file, _) = app.repository.copyUriToImports(uri)
                val validated = app.pluginManager.inspectArchive(file)
                val installed = app.pluginManager.installVerified(file, validated)
                plugins = app.pluginManager.listInstalled()
                statusBanner = "Installed .wrplugin ${installed.manifest.name} (disabled until reviewed)"
            }.onFailure { err ->
                statusBanner = "Plugin error: ${err.message}"
            }
        }
    }

    val runtimeTarPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        if (uri != null && !isExtracting) {
            isExtracting = true
            scope.launch {
                val res = withContext(Dispatchers.IO) {
                    app.runtimeManager.extractCustomTarXzUri(context, uri) { p ->
                        scope.launch { installProgress = p }
                    }
                }
                runtimeStatus = app.runtimeManager.inspectStatus(context)
                isExtracting = false
                res.onSuccess {
                    val updated = appState.copy(initialized = true)
                    app.repository.saveState(updated)
                    appState = updated
                    statusBanner = "Runtime extracted cleanly from local archive."
                }.onFailure { err ->
                    statusBanner = "Runtime import error: ${err.message}"
                }
            }
        }
    }

    fun startBundledExtraction(autoFinishSetup: Boolean) {
        if (isExtracting) return
        isExtracting = true
        scope.launch {
            val res = withContext(Dispatchers.IO) {
                app.runtimeManager.extractBundledRuntime(context) { p ->
                    scope.launch { installProgress = p }
                }
            }
            runtimeStatus = app.runtimeManager.inspectStatus(context)
            isExtracting = false
            res.onSuccess {
                if (autoFinishSetup) {
                    val updated = appState.copy(initialized = true)
                    app.repository.saveState(updated)
                    appState = updated
                }
                statusBanner = "WPhone Wine WoW64 + Box64 environment installed cleanly."
            }.onFailure { err ->
                statusBanner = "Environment install error: ${err.message}"
            }
        }
    }

    fun launchWindowsApp(target: WindowsAppConfig) {
        runtimeStatus = app.runtimeManager.inspectStatus(context)
        if (!runtimeStatus.isInstalled) {
            statusBanner = "Runtime belum terpasang/ekstrak. Pasang environment terlebih dahulu."
            return
        }
        val intent = Intent(context, WineWorkspaceActivity::class.java).apply {
            putExtra(WineWorkspaceActivity.EXTRA_APP_JSON, Json.encodeToString(target))
        }
        context.startActivity(intent)
    }

    if (!appState.initialized) {
        SetupWizardScreen(
            caps = caps,
            runtimeStatus = runtimeStatus,
            isExtracting = isExtracting,
            progress = installProgress,
            selectedProfile = appState.selectedProfile,
            onSelectProfile = { profile ->
                appState = appState.copy(selectedProfile = profile)
            },
            onInstallBundled = {
                if (runtimeStatus.hasBundledAsset && !runtimeStatus.isInstalled) {
                    startBundledExtraction(autoFinishSetup = true)
                } else {
                    val updated = appState.copy(initialized = true)
                    app.repository.saveState(updated)
                    appState = updated
                }
            },
            onPickLocalArchive = { runtimeTarPicker.launch(arrayOf("*/*")) }
        )
        return
    }

    Scaffold(
        floatingActionButton = {
            if (selectedTab == 0) {
                FloatingActionButton(onClick = { exePicker.launch(arrayOf("*/*")) }) {
                    Icon(Icons.Default.Add, contentDescription = "Import Windows .exe/.msi")
                }
            } else if (selectedTab == 2) {
                FloatingActionButton(onClick = { pluginPicker.launch(arrayOf("*/*")) }) {
                    Icon(Icons.Default.Add, contentDescription = "Install .wrplugin")
                }
            }
        },
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    icon = { Icon(Icons.Default.Apps, contentDescription = null) },
                    label = { Text("Library") }
                )
                NavigationBarItem(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    icon = { Icon(Icons.Default.Build, contentDescription = null) },
                    label = { Text("Registry") }
                )
                NavigationBarItem(
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    icon = { Icon(Icons.Default.Extension, contentDescription = null) },
                    label = { Text("Plugins") }
                )
                NavigationBarItem(
                    selected = selectedTab == 3,
                    onClick = { selectedTab = 3 },
                    icon = { Icon(Icons.Default.Keyboard, contentDescription = null) },
                    label = { Text("Input") }
                )
                NavigationBarItem(
                    selected = selectedTab == 4,
                    onClick = { selectedTab = 4 },
                    icon = { Icon(Icons.Default.Settings, contentDescription = null) },
                    label = { Text("Admin") }
                )
            }
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding).padding(16.dp).fillMaxSize()) {
            statusBanner?.let { msg ->
                Card(
                    modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp).fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(msg, style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f))
                        TextButton(onClick = { statusBanner = null }) { Text("OK") }
                    }
                }
            }

            when (selectedTab) {
                0 -> LibraryScreen(
                    apps = appState.apps,
                    app = app,
                    runtimeStatus = runtimeStatus,
                    isExtracting = isExtracting,
                    progress = installProgress,
                    nppDownloading = nppDownloading,
                    nppProgressText = nppProgressText,
                    onExtractRuntime = { startBundledExtraction(autoFinishSetup = false) },
                    onDownloadNpp = {
                        if (!nppDownloading) {
                            nppDownloading = true
                            scope.launch {
                                var lastReportedMb = -1L
                                val res = withContext(Dispatchers.IO) {
                                    app.runtimeManager.downloadNotepadPlusPlusPortable(app.prefixManager.prefixesDir()) { got, total ->
                                        val mbGot = got / (1024 * 1024)
                                        if (mbGot != lastReportedMb) {
                                            lastReportedMb = mbGot
                                            val mbTot = if (total > 0) "${total / (1024 * 1024)} MB" else "?"
                                            scope.launch { nppProgressText = "Downloading $mbGot MB / $mbTot" }
                                        }
                                    }
                                }
                                nppDownloading = false
                                nppProgressText = null
                                res.onSuccess {
                                    statusBanner = "Notepad++ Portable installed cleanly into pfx-notepadpp."
                                }.onFailure { err ->
                                    statusBanner = "Notepad++ download failed: ${err.message}"
                                }
                            }
                        }
                    },
                    onLaunch = { launchWindowsApp(it) }
                )
                1 -> RegistryEditorScreen(
                    apps = appState.apps,
                    repo = app.repository,
                    onSaved = { statusBanner = it }
                )
                2 -> PluginScreen(
                    plugins = plugins,
                    onToggle = { id ->
                        val updated = plugins.map {
                            if (it.manifest.id == id) it.copy(enabled = !it.enabled) else it
                        }
                        app.pluginManager.saveInstalled(updated)
                        plugins = updated
                    }
                )
                3 -> KeyboardTestScreen()
                4 -> AdminDiagnosticsScreen(
                    app = app,
                    caps = caps,
                    runtimeStatus = runtimeStatus,
                    onReExtract = { startBundledExtraction(autoFinishSetup = false) },
                    onImportTar = { runtimeTarPicker.launch(arrayOf("*/*")) },
                    onBanner = { statusBanner = it }
                )
            }
        }
    }
}

@Composable
private fun SetupWizardScreen(
    caps: DeviceCapabilities,
    runtimeStatus: RuntimeInstallStatus,
    isExtracting: Boolean,
    progress: RuntimeInstallProgress?,
    selectedProfile: EasyProfile,
    onSelectProfile: (EasyProfile) -> Unit,
    onInstallBundled: () -> Unit,
    onPickLocalArchive: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(stringResource(R.string.wizard_title), style = MaterialTheme.typography.headlineSmall)
        Text(stringResource(R.string.wizard_subtitle), style = MaterialTheme.typography.bodyMedium)

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Device: ${caps.socModel}")
                Text("Android API ${caps.androidSdk} · ${caps.primaryAbi} · RAM ${caps.totalRamMb} MB")
                Text("Graphics: ${caps.recommendedGraphics.name} · Audio: ${caps.recommendedAudio.name}")
                Text(
                    "Bundled Asset: ${if (runtimeStatus.hasBundledAsset) "Available in APK" else "Not bundled"} · PRoot: ${runtimeStatus.hasProotBinary} · Wine: ${runtimeStatus.hasWineBinary} · Box64: ${runtimeStatus.hasBox64Binary}",
                    style = MaterialTheme.typography.labelSmall,
                    fontFamily = FontFamily.Monospace
                )
                if (caps.memoryBudget.isSubAndroid10 || caps.memoryBudget.isLowRamMode) {
                    Text(
                        "Sub-Android 10 Lightweight Mode Active (Cap: ${caps.memoryBudget.maxVirtualResolution}, Container ${caps.memoryBudget.estimatedContainerCapMb} MB)",
                        color = Color(0xFF0284C7),
                        style = MaterialTheme.typography.bodySmall
                    )
                }
                caps.compatibilityWarnings.forEach { warn ->
                    Text(warn, color = Color(0xFFD97706), style = MaterialTheme.typography.bodySmall)
                }
            }
        }

        if (isExtracting && progress != null) {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(progress.phase, style = MaterialTheme.typography.titleSmall)
                    if (progress.totalBytes > 0) {
                        val ratio = (progress.bytesProcessed.toFloat() / progress.totalBytes.toFloat()).coerceIn(0f, 1f)
                        LinearProgressIndicator(progress = { ratio }, modifier = Modifier.fillMaxWidth())
                    } else {
                        LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                    }
                    Text(
                        "${progress.bytesProcessed / (1024 * 1024)} MB · ${progress.currentFile}",
                        style = MaterialTheme.typography.labelSmall,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }
        }

        EasyProfile.entries.forEach { profile ->
            OutlinedCard(
                onClick = { onSelectProfile(profile) },
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(14.dp).fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(profile.name, style = MaterialTheme.typography.titleMedium)
                        Text(
                            when (profile) {
                                EasyProfile.LIGHT -> "VirGL/GLES + OpenSL ES · Ideal for Android 7–9 & 2–4 GB RAM"
                                EasyProfile.MEDIUM -> "System Vulkan + DXVK + VC++ essentials"
                                EasyProfile.ADVANCED -> "Turnip + DXVK + VKD3D-Proton full suite"
                            },
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                    RadioButton(selected = selectedProfile == profile, onClick = { onSelectProfile(profile) })
                }
            }
        }

        Button(
            onClick = onInstallBundled,
            enabled = !isExtracting,
            modifier = Modifier.fillMaxWidth().height(48.dp)
        ) {
            Text(
                when {
                    isExtracting -> "Extracting Runtime Environment..."
                    runtimeStatus.isInstalled -> "Open WPhone Library"
                    runtimeStatus.hasBundledAsset -> "Install & Extract Bundled Environment"
                    else -> "Continue to Library (Import Runtime Later)"
                }
            )
        }

        OutlinedButton(
            onClick = onPickLocalArchive,
            enabled = !isExtracting,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Import Custom Runtime (.tar.xz)")
        }
    }
}

@Composable
private fun LibraryScreen(
    apps: List<WindowsAppConfig>,
    app: WPhoneApplication,
    runtimeStatus: RuntimeInstallStatus,
    isExtracting: Boolean,
    progress: RuntimeInstallProgress?,
    nppDownloading: Boolean,
    nppProgressText: String?,
    onExtractRuntime: () -> Unit,
    onDownloadNpp: () -> Unit,
    onLaunch: (WindowsAppConfig) -> Unit
) {
    val rootfsDir = app.runtimeManager.rootfsDir()
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(stringResource(R.string.library_title), style = MaterialTheme.typography.titleLarge)
        Text(
            "Launches directly into Fullscreen Landscape X11 Workspace with Direct Touch Mouse & Hideable Keyboard.",
            style = MaterialTheme.typography.bodySmall
        )

        if (!runtimeStatus.isInstalled) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)
            ) {
                Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        "Environment Missing: PRoot=${runtimeStatus.hasProotBinary}, Wine=${runtimeStatus.hasWineBinary}, Box64=${runtimeStatus.hasBox64Binary}",
                        style = MaterialTheme.typography.bodySmall
                    )
                    if (isExtracting && progress != null) {
                        LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                        Text("${progress.bytesProcessed / (1024 * 1024)} MB · ${progress.currentFile}", style = MaterialTheme.typography.labelSmall)
                    } else if (runtimeStatus.hasBundledAsset) {
                        Button(onClick = onExtractRuntime) {
                            Text("Extract Bundled Environment Now")
                        }
                    }
                }
            }
        }

        LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(apps, key = { it.id }) { item ->
                val hive = remember(item.prefixId) { app.repository.readPrefixHive(item.prefixId) }
                val exeReady = app.repository.isAppExecutableReady(item, rootfsDir)
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(item.name, style = MaterialTheme.typography.titleMedium)
                        Text(
                            "${item.arch.name} · ${item.graphicsBackend.name} · ${item.audioBackend.name}",
                            style = MaterialTheme.typography.bodySmall
                        )
                        Text(
                            "Prefix: ${item.prefixId} (${hive.winVersion}) · Target: ${item.executablePath}",
                            style = MaterialTheme.typography.labelSmall,
                            fontFamily = FontFamily.Monospace
                        )

                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (item.id == "notepadpp" && !exeReady) {
                                Button(
                                    onClick = onDownloadNpp,
                                    enabled = !nppDownloading
                                ) {
                                    Icon(Icons.Default.Download, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(6.dp))
                                    Text(nppProgressText ?: "Download Notepad++ Portable")
                                }
                            } else {
                                Button(
                                    onClick = { onLaunch(item) },
                                    enabled = runtimeStatus.isInstalled && (exeReady || item.id == "wine-notepad")
                                ) {
                                    Icon(Icons.Default.PlayArrow, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(6.dp))
                                    Text(stringResource(R.string.launch_app))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RegistryEditorScreen(
    apps: List<WindowsAppConfig>,
    repo: WPhoneRepository,
    onSaved: (String) -> Unit
) {
    var selectedApp by remember(apps) { mutableStateOf(apps.firstOrNull()) }
    var hive by remember(selectedApp?.prefixId) {
        mutableStateOf(selectedApp?.let { repo.readPrefixHive(it.prefixId) } ?: WineRegistryHive())
    }
    var dllName by remember { mutableStateOf("msvcp140") }
    var overrideMode by remember { mutableStateOf(DllOverrideMode.NATIVE_BUILTIN) }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("Wine Registry (.reg) & DLL Overrides", style = MaterialTheme.typography.titleLarge)
        selectedApp?.let { current ->
            Text("Active Prefix: ${current.prefixId} (${current.name})", style = MaterialTheme.typography.bodyMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("win7", "win10", "win11").forEach { ver ->
                    FilterChip(
                        selected = hive.winVersion == ver,
                        onClick = { hive = hive.copy(winVersion = ver) },
                        label = { Text(ver) }
                    )
                }
            }

            OutlinedTextField(
                value = dllName,
                onValueChange = { dllName = it },
                label = { Text("DLL Name (e.g. msvcp140, d3d11)") },
                modifier = Modifier.fillMaxWidth()
            )
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf(
                    DllOverrideMode.NATIVE_BUILTIN,
                    DllOverrideMode.BUILTIN_NATIVE,
                    DllOverrideMode.NATIVE_ONLY,
                    DllOverrideMode.BUILTIN_ONLY
                ).forEach { m ->
                    FilterChip(
                        selected = overrideMode == m,
                        onClick = { overrideMode = m },
                        label = { Text(m.wineCode) }
                    )
                }
            }
            Button(onClick = {
                val nextMap = hive.dllOverrides.toMutableMap()
                if (dllName.isNotBlank()) nextMap[dllName.trim().lowercase()] = overrideMode
                val nextHive = hive.copy(dllOverrides = nextMap)
                repo.savePrefixHive(current.prefixId, current.name, nextHive)
                hive = nextHive
                onSaved("Saved user.reg for ${current.prefixId}")
            }) {
                Text("Add & Write user.reg")
            }

            Card(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = hive.serializeUserReg(current.name),
                    fontFamily = FontFamily.Monospace,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(12.dp)
                )
            }
        }
    }
}

@Composable
private fun PluginScreen(
    plugins: List<InstalledPluginState>,
    onToggle: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(".wrplugin Manager", style = MaterialTheme.typography.titleLarge)
        Text("Tap + to validate & extract a .wrplugin ZIP package.", style = MaterialTheme.typography.bodySmall)
        if (plugins.isEmpty()) {
            Card(modifier = Modifier.fillMaxWidth()) {
                Text("No .wrplugin archives installed yet.", modifier = Modifier.padding(16.dp))
            }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(plugins, key = { it.manifest.id }) { pl ->
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Row(
                            modifier = Modifier.padding(14.dp).fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(pl.manifest.name, style = MaterialTheme.typography.titleMedium)
                                Text(
                                    "${pl.manifest.version} · ${pl.manifest.category} · SHA ${pl.sha256.take(10)}",
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                            Switch(checked = pl.enabled, onCheckedChange = { onToggle(pl.manifest.id) })
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun KeyboardTestScreen() {
    var gamingMode by remember { mutableStateOf(false) }
    var lastCombo by remember { mutableStateOf("Ready") }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Dual Keyboard Studio", style = MaterialTheme.typography.titleLarge)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(selected = !gamingMode, onClick = { gamingMode = false }, label = { Text("Desktop Keys") })
            FilterChip(selected = gamingMode, onClick = { gamingMode = true }, label = { Text("Gaming Pad") })
        }
        Text("Last dispatched event: $lastCombo", fontFamily = FontFamily.Monospace)
        if (gamingMode) {
            GamingVirtualPadBar { k, c, a, s -> lastCombo = listOfNotNull(if (c) "Ctrl" else null, if (a) "Alt" else null, if (s) "Shift" else null, k).joinToString("+") }
        } else {
            DesktopModifierBar { k, c, a, s -> lastCombo = listOfNotNull(if (c) "Ctrl" else null, if (a) "Alt" else null, if (s) "Shift" else null, k).joinToString("+") }
        }
    }
}

@Composable
private fun AdminDiagnosticsScreen(
    app: WPhoneApplication,
    caps: DeviceCapabilities,
    runtimeStatus: RuntimeInstallStatus,
    onReExtract: () -> Unit,
    onImportTar: () -> Unit,
    onBanner: (String) -> Unit
) {
    val audioBridge = remember {
        WPhoneNativeBridge.getRecommendedAudioBackend(caps.memoryBudget.isLowRamMode || caps.memoryBudget.isSubAndroid10)
    }
    val pageKb = remember { WPhoneNativeBridge.getHostPageSizeKb() }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(stringResource(R.string.admin_title), style = MaterialTheme.typography.titleLarge)
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("JNI ABI: ${WPhoneNativeBridge.getNativeAbiInfo()}", style = MaterialTheme.typography.bodySmall)
                Text("Active Audio Sink: $audioBridge · Page Size: ${pageKb} KB", style = MaterialTheme.typography.bodySmall)
                Text(
                    "Runtime Installed: ${runtimeStatus.isInstalled} (PRoot=${runtimeStatus.hasProotBinary}, Wine=${runtimeStatus.hasWineBinary}, Box64=${runtimeStatus.hasBox64Binary})",
                    style = MaterialTheme.typography.bodySmall
                )
                Text(runtimeStatus.bundleSummary, style = MaterialTheme.typography.labelSmall, fontFamily = FontFamily.Monospace)
                Text("Workspace Root: ${app.wphoneRoot.absolutePath}", style = MaterialTheme.typography.bodySmall)
                Text(stringResource(R.string.warning_prefix_not_sandbox), color = Color(0xFFD97706), style = MaterialTheme.typography.bodySmall)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (runtimeStatus.hasBundledAsset) {
                Button(onClick = onReExtract) { Text("Re-Extract Runtime") }
            }
            OutlinedButton(onClick = onImportTar) { Text("Import .tar.xz") }
        }
        Button(onClick = {
            val res = app.fileGuard.deleteSafely(File(app.wphoneRoot, "runtime"))
            onBanner(res.exceptionOrNull()?.message ?: "Deleted")
        }) {
            Text("Verify Protected Runtime Guard")
        }
    }
}
