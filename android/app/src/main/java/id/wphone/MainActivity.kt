package id.wphone

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Apps
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Extension
import androidx.compose.material.icons.filled.Keyboard
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material.icons.filled.MonitorHeart
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.wphone.core.config.DeviceCapabilities
import id.wphone.core.config.EasyProfile
import id.wphone.core.config.OrientationMode
import id.wphone.core.config.ThemeMode
import id.wphone.core.config.WindowsAppConfig
import id.wphone.core.input.InputLayoutEditorCanvas
import id.wphone.core.plugin.InstalledPluginState
import id.wphone.core.prefix.DllOverrideMode
import id.wphone.core.prefix.WineRegistryHive
import id.wphone.core.runtime.AdminShellRunner
import id.wphone.core.runtime.LiveSystemTelemetry
import id.wphone.core.runtime.RuntimeInstallProgress
import id.wphone.core.runtime.RuntimeInstallStatus
import id.wphone.core.runtime.SystemTelemetryReader
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File

private val WPhoneDarkScheme = darkColorScheme(
    primary = Color(0xFF38BDF8),
    onPrimary = Color(0xFF041320),
    background = Color(0xFF0B1120),
    onBackground = Color(0xFFE2E8F0),
    surface = Color(0xFF111827),
    onSurface = Color(0xFFE2E8F0),
    surfaceVariant = Color(0xFF1E293B),
    onSurfaceVariant = Color(0xFF94A3B8),
    outline = Color(0xFF1E293B),
    secondaryContainer = Color(0xFF172554),
    onSecondaryContainer = Color(0xFFBAE6FD)
)

private val WPhoneLightScheme = lightColorScheme(
    primary = Color(0xFF0078D4),
    onPrimary = Color.White,
    background = Color(0xFFF8FAFC),
    onBackground = Color(0xFF0F172A),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF0F172A),
    surfaceVariant = Color(0xFFF1F5F9),
    onSurfaceVariant = Color(0xFF475569),
    outline = Color(0xFFE2E8F0)
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val app = application as WPhoneApplication
        val caps = app.deviceAnalyzer.analyze()

        setContent {
            var appState by remember { mutableStateOf(app.repository.loadState(caps)) }
            val sysDark = isSystemInDarkTheme()
            val useDark = when (appState.themeMode) {
                ThemeMode.DARK -> true
                ThemeMode.LIGHT -> false
                ThemeMode.SYSTEM -> sysDark
            }

            MaterialTheme(colorScheme = if (useDark) WPhoneDarkScheme else WPhoneLightScheme) {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    WPhoneOfficialShell(
                        app = app,
                        caps = caps,
                        appState = appState,
                        onUpdateState = { next ->
                            app.repository.saveState(next)
                            appState = next
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun WPhoneOfficialShell(
    app: WPhoneApplication,
    caps: DeviceCapabilities,
    appState: PersistedAppState,
    onUpdateState: (PersistedAppState) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

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
                onUpdateState(nextState)
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
                    onUpdateState(appState.copy(initialized = true))
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
                    onUpdateState(appState.copy(initialized = true))
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
                onUpdateState(appState.copy(selectedProfile = profile))
            },
            onInstallBundled = {
                if (runtimeStatus.hasBundledAsset && !runtimeStatus.isInstalled) {
                    startBundledExtraction(autoFinishSetup = true)
                } else {
                    onUpdateState(appState.copy(initialized = true))
                }
            },
            onPickLocalArchive = { runtimeTarPicker.launch(arrayOf("*/*")) }
        )
        return
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            Surface(
                color = MaterialTheme.colorScheme.surface,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Image(
                            painter = painterResource(R.drawable.ic_wphone_launcher),
                            contentDescription = "WPhone Icon",
                            modifier = Modifier
                                .size(34.dp)
                                .clip(RoundedCornerShape(8.dp))
                        )
                        Column {
                            Text(
                                "WPhone",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                "v1.2.0 · ARM64 Wine WoW64",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }

                    // Eye-Care Theme Mode Switcher
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                        onClick = {
                            val next = when (appState.themeMode) {
                                ThemeMode.DARK -> ThemeMode.LIGHT
                                ThemeMode.LIGHT -> ThemeMode.SYSTEM
                                ThemeMode.SYSTEM -> ThemeMode.DARK
                            }
                            onUpdateState(appState.copy(themeMode = next))
                        }
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Icon(
                                if (appState.themeMode == ThemeMode.LIGHT) Icons.Default.LightMode else Icons.Default.DarkMode,
                                contentDescription = "Toggle Theme",
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(16.dp)
                            )
                            Text(
                                text = when (appState.themeMode) {
                                    ThemeMode.DARK -> "Dark"
                                    ThemeMode.LIGHT -> "Light"
                                    ThemeMode.SYSTEM -> "Auto"
                                },
                                style = MaterialTheme.typography.labelMedium
                            )
                        }
                    }
                }
            }
        },
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
            NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
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
                OutlinedCard(
                    modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                    colors = CardDefaults.outlinedCardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.4f))
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp).fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
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
                    onToggleSafeMode = { appId, safe ->
                        val nextApps = appState.apps.map {
                            if (it.id == appId) it.copy(box64SafeMode = safe) else it
                        }
                        onUpdateState(appState.copy(apps = nextApps))
                    },
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
                3 -> InputLayoutEditorCanvas(
                    preset = appState.inputPreset,
                    onUpdatePreset = { nextPreset ->
                        onUpdateState(appState.copy(inputPreset = nextPreset))
                    }
                )
                4 -> AdminDiagnosticsScreen(
                    app = app,
                    caps = caps,
                    appState = appState,
                    runtimeStatus = runtimeStatus,
                    onUpdateState = onUpdateState,
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
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Image(
                painter = painterResource(R.drawable.ic_wphone_launcher),
                contentDescription = "WPhone Icon",
                modifier = Modifier.size(48.dp).clip(RoundedCornerShape(10.dp))
            )
            Column {
                Text(stringResource(R.string.wizard_title), style = MaterialTheme.typography.headlineSmall)
                Text(
                    stringResource(R.string.wizard_subtitle),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        OutlinedCard(
            modifier = Modifier.fillMaxWidth(),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Device: ${caps.socModel}", fontWeight = FontWeight.Medium)
                Text("Android API ${caps.androidSdk} · ${caps.primaryAbi} · RAM ${caps.totalRamMb} MB", fontFamily = FontFamily.Monospace, fontSize = 12.sp)
                Text("Graphics: ${caps.recommendedGraphics.name} · Audio: ${caps.recommendedAudio.name}", style = MaterialTheme.typography.bodySmall)
                Text(
                    "Bundled Asset: ${if (runtimeStatus.hasBundledAsset) "Available in APK" else "Not bundled"} · PRoot: ${runtimeStatus.hasProotBinary} · Wine: ${runtimeStatus.hasWineBinary} · Box64: ${runtimeStatus.hasBox64Binary}",
                    style = MaterialTheme.typography.labelSmall,
                    fontFamily = FontFamily.Monospace
                )
                if (caps.memoryBudget.isSubAndroid10 || caps.memoryBudget.isLowRamMode) {
                    Text(
                        "Sub-Android 10 Lightweight Mode Active (Cap: ${caps.memoryBudget.maxVirtualResolution}, Container ${caps.memoryBudget.estimatedContainerCapMb} MB)",
                        color = MaterialTheme.colorScheme.primary,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
                caps.compatibilityWarnings.forEach { warn ->
                    Text(warn, color = Color(0xFFF59E0B), style = MaterialTheme.typography.bodySmall)
                }
            }
        }

        if (isExtracting && progress != null) {
            OutlinedCard(
                modifier = Modifier.fillMaxWidth(),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
            ) {
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
                modifier = Modifier.fillMaxWidth(),
                border = BorderStroke(
                    width = if (selectedProfile == profile) 1.5.dp else 1.dp,
                    color = if (selectedProfile == profile) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline
                )
            ) {
                Row(
                    modifier = Modifier.padding(14.dp).fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(profile.name, style = MaterialTheme.typography.titleMedium)
                        Text(
                            when (profile) {
                                EasyProfile.LIGHT -> "VirGL/GLES + OpenSL ES · Ideal for Android 7–9 & 2–4 GB RAM"
                                EasyProfile.MEDIUM -> "System Vulkan + DXVK + VC++ essentials"
                                EasyProfile.ADVANCED -> "Turnip + DXVK + VKD3D-Proton full suite"
                            },
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
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
    onToggleSafeMode: (appId: String, safe: Boolean) -> Unit,
    onExtractRuntime: () -> Unit,
    onDownloadNpp: () -> Unit,
    onLaunch: (WindowsAppConfig) -> Unit
) {
    val rootfsDir = app.runtimeManager.rootfsDir()
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(stringResource(R.string.library_title), style = MaterialTheme.typography.titleLarge)
        Text(
            "Supports Dynamic Auto / Landscape / Portrait X11 workspaces, Unified PC+QWERTY Keyboard, JoiPlay PS/Nintendo Gamepad, and Box64 Safe Mode.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        if (!runtimeStatus.isInstalled) {
            OutlinedCard(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.outlinedCardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.5f))
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
                OutlinedCard(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.outlinedCardColors(containerColor = MaterialTheme.colorScheme.surface),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
                ) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(item.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Text(
                            "${item.arch.name} · ${item.graphicsBackend.name} · ${item.audioBackend.name}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            "Prefix: ${item.prefixId} (${hive.winVersion}) · ${item.executablePath}",
                            style = MaterialTheme.typography.labelSmall,
                            fontFamily = FontFamily.Monospace,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                "Box64 Safe Mode (Fix 139)",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Switch(
                                checked = item.box64SafeMode,
                                onCheckedChange = { onToggleSafeMode(item.id, it) }
                            )
                        }

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

        Row(
            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            apps.forEach { appCfg ->
                FilterChip(
                    selected = selectedApp?.id == appCfg.id,
                    onClick = { selectedApp = appCfg },
                    label = { Text(appCfg.name) }
                )
            }
        }

        selectedApp?.let { current ->
            Text("Active Prefix: ${current.prefixId}", style = MaterialTheme.typography.bodyMedium, fontFamily = FontFamily.Monospace)
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
            Row(
                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
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

            OutlinedCard(
                modifier = Modifier.fillMaxWidth(),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
            ) {
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
            OutlinedCard(
                modifier = Modifier.fillMaxWidth(),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
            ) {
                Text("No .wrplugin archives installed yet.", modifier = Modifier.padding(16.dp))
            }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(plugins, key = { it.manifest.id }) { pl ->
                    OutlinedCard(
                        modifier = Modifier.fillMaxWidth(),
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp).fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(pl.manifest.name, style = MaterialTheme.typography.titleMedium)
                                Text(
                                    "${pl.manifest.version} · ${pl.manifest.category} · SHA ${pl.sha256.take(10)}",
                                    style = MaterialTheme.typography.bodySmall,
                                    fontFamily = FontFamily.Monospace
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
private fun AdminDiagnosticsScreen(
    app: WPhoneApplication,
    caps: DeviceCapabilities,
    appState: PersistedAppState,
    runtimeStatus: RuntimeInstallStatus,
    onUpdateState: (PersistedAppState) -> Unit,
    onReExtract: () -> Unit,
    onImportTar: () -> Unit,
    onBanner: (String) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val audioBridge = remember {
        WPhoneNativeBridge.getRecommendedAudioBackend(caps.memoryBudget.isLowRamMode || caps.memoryBudget.isSubAndroid10)
    }
    val pageKb = remember { WPhoneNativeBridge.getHostPageSizeKb() }

    var adminSubTab by remember { mutableIntStateOf(0) } // 0: Task Manager, 1: Runtime & Storage, 2: CMD Shell
    var telemetry by remember { mutableStateOf(SystemTelemetryReader.read(context)) }
    var cmdInput by remember { mutableStateOf("uname -a && ls -la /opt/wine/bin") }
    var cmdOutput by remember { mutableStateOf("WPhone PRoot Admin CMD Shell ready.\nType any Linux/Wine/Box64 diagnostic command below or tap a preset.") }
    var cmdRunning by remember { mutableStateOf(false) }

    LaunchedEffect(adminSubTab) {
        while (true) {
            telemetry = SystemTelemetryReader.read(context)
            delay(1000L)
        }
    }

    fun executeShell(command: String) {
        if (command.isBlank() || cmdRunning) return
        cmdRunning = true
        scope.launch {
            val runner = AdminShellRunner(context, app.runtimeManager, app.prefixManager.prefixesDir())
            val (code, out) = withContext(Dispatchers.IO) { runner.execute(command) }
            cmdOutput = "$ $command\n$out\n[exit $code]"
            cmdRunning = false
        }
    }

    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("Windows Task Manager & Admin Control", style = MaterialTheme.typography.titleLarge)

        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            FilterChip(
                selected = adminSubTab == 0,
                onClick = { adminSubTab = 0 },
                leadingIcon = { Icon(Icons.Default.MonitorHeart, contentDescription = null, modifier = Modifier.size(16.dp)) },
                label = { Text("Task Manager") }
            )
            FilterChip(
                selected = adminSubTab == 1,
                onClick = { adminSubTab = 1 },
                leadingIcon = { Icon(Icons.Default.Settings, contentDescription = null, modifier = Modifier.size(16.dp)) },
                label = { Text("Runtime") }
            )
            FilterChip(
                selected = adminSubTab == 2,
                onClick = { adminSubTab = 2 },
                leadingIcon = { Icon(Icons.Default.Terminal, contentDescription = null, modifier = Modifier.size(16.dp)) },
                label = { Text("CMD Shell") }
            )
        }

        when (adminSubTab) {
            0 -> Column(
                modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedCard(
                    modifier = Modifier.fillMaxWidth(),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
                ) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("CPU Utilization", style = MaterialTheme.typography.titleSmall)
                            Text("${telemetry.cpuPercent}%", fontFamily = FontFamily.Monospace, color = MaterialTheme.colorScheme.primary)
                        }
                        LinearProgressIndicator(
                            progress = { (telemetry.cpuPercent / 100f).coerceIn(0f, 1f) },
                            modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp))
                        )

                        Spacer(Modifier.height(4.dp))

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Memory Used", style = MaterialTheme.typography.titleSmall)
                            Text(
                                "${telemetry.ramUsedMb} / ${telemetry.ramTotalMb} MB",
                                fontFamily = FontFamily.Monospace,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                        val ramRatio = (telemetry.ramUsedMb.toFloat() / telemetry.ramTotalMb.toFloat().coerceAtLeast(1f)).coerceIn(0f, 1f)
                        LinearProgressIndicator(
                            progress = { ramRatio },
                            modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp))
                        )

                        Text(
                            "Free RAM: ${telemetry.ramFreeMb} MB · Storage Free: ${"%.2f".format(telemetry.storageFreeGb)} / ${"%.2f".format(telemetry.storageTotalGb)} GB",
                            style = MaterialTheme.typography.labelSmall,
                            fontFamily = FontFamily.Monospace,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                OutlinedCard(
                    modifier = Modifier.fillMaxWidth(),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
                ) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Global Execution & Display Settings", style = MaterialTheme.typography.titleSmall)
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Global Box64 Safe Mode (Dynarec OFF)", style = MaterialTheme.typography.bodyMedium)
                                Text(
                                    "Prevents SIGSEGV (exit 139) on Notepad++, older kernels, or unstable EXEs.",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Switch(
                                checked = appState.globalBox64SafeMode,
                                onCheckedChange = { onUpdateState(appState.copy(globalBox64SafeMode = it)) }
                            )
                        }

                        Text("Default Workspace Orientation:", style = MaterialTheme.typography.labelMedium)
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            OrientationMode.entries.forEach { mode ->
                                FilterChip(
                                    selected = appState.orientationMode == mode,
                                    onClick = { onUpdateState(appState.copy(orientationMode = mode)) },
                                    label = {
                                        Text(
                                            when (mode) {
                                                OrientationMode.DYNAMIC_AUTO -> "Dynamic Auto"
                                                OrientationMode.LANDSCAPE -> "Landscape"
                                                OrientationMode.PORTRAIT -> "Portrait"
                                            }
                                        )
                                    }
                                )
                            }
                        }
                    }
                }

                OutlinedCard(
                    modifier = Modifier.fillMaxWidth(),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
                ) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("Kernel & Host Diagnostics", style = MaterialTheme.typography.titleSmall)
                        Text("JNI ABI: ${WPhoneNativeBridge.getNativeAbiInfo()}", style = MaterialTheme.typography.bodySmall, fontFamily = FontFamily.Monospace)
                        Text("Audio Sink: $audioBridge · Host Page: $pageKb KB", style = MaterialTheme.typography.bodySmall, fontFamily = FontFamily.Monospace)
                        Text("SoC: ${caps.socModel}", style = MaterialTheme.typography.bodySmall)
                        Text(stringResource(R.string.warning_prefix_not_sandbox), color = Color(0xFFF59E0B), style = MaterialTheme.typography.bodySmall)
                    }
                }
            }

            1 -> Column(
                modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedCard(
                    modifier = Modifier.fillMaxWidth(),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
                ) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Wine WoW64 + Box64 Rootfs Status", style = MaterialTheme.typography.titleSmall)
                        Text(
                            "Installed=${runtimeStatus.isInstalled} · PRoot=${runtimeStatus.hasProotBinary} · Wine=${runtimeStatus.hasWineBinary} · Box64=${runtimeStatus.hasBox64Binary}",
                            style = MaterialTheme.typography.labelSmall,
                            fontFamily = FontFamily.Monospace
                        )
                        Text(runtimeStatus.bundleSummary, style = MaterialTheme.typography.labelSmall, fontFamily = FontFamily.Monospace)
                        Text("Workspace Root: ${app.wphoneRoot.absolutePath}", style = MaterialTheme.typography.bodySmall, fontFamily = FontFamily.Monospace)
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (runtimeStatus.hasBundledAsset) {
                        Button(onClick = onReExtract) { Text("Re-Extract Runtime") }
                    }
                    OutlinedButton(onClick = onImportTar) { Text("Import .tar.xz") }
                }

                OutlinedButton(onClick = {
                    val res = app.fileGuard.deleteSafely(File(app.wphoneRoot, "runtime"))
                    onBanner(res.exceptionOrNull()?.message ?: "Deleted")
                }) {
                    Text("Verify Protected Runtime Guard")
                }
            }

            else -> Column(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    listOf(
                        "uname -a",
                        "box64 --version",
                        "ls -la /opt/wine/bin",
                        "ls -la /opt/wphone_prefixes",
                        "ldd /usr/local/bin/box64",
                        "cat /etc/os-release"
                    ).forEach { presetCmd ->
                        AssistChip(
                            onClick = {
                                cmdInput = presetCmd
                                executeShell(presetCmd)
                            },
                            label = { Text(presetCmd, fontFamily = FontFamily.Monospace, fontSize = 11.sp) }
                        )
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = cmdInput,
                        onValueChange = { cmdInput = it },
                        label = { Text("PRoot Distro / Wine CMD") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    Button(
                        onClick = { executeShell(cmdInput) },
                        enabled = !cmdRunning,
                        modifier = Modifier.height(52.dp)
                    ) {
                        Text(if (cmdRunning) "..." else "Run")
                    }
                }

                OutlinedCard(
                    modifier = Modifier.fillMaxWidth().weight(1f),
                    colors = CardDefaults.outlinedCardColors(containerColor = Color(0xFF050811)),
                    border = BorderStroke(1.dp, Color(0xFF1E293B))
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(12.dp)
                    ) {
                        Text(
                            text = cmdOutput,
                            color = Color(0xFF38BDF8),
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp
                        )
                    }
                }
            }
        }
    }
}
