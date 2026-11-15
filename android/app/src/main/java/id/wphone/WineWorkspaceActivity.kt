package id.wphone

import android.content.Context
import android.content.pm.ActivityInfo
import android.os.Bundle
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Gamepad
import androidx.compose.material.icons.filled.Keyboard
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Mouse
import androidx.compose.material.icons.filled.RestartAlt
import androidx.compose.material.icons.filled.ScreenRotation
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import id.wphone.core.config.GamepadSkin
import id.wphone.core.config.OrientationMode
import id.wphone.core.config.OverlayMode
import id.wphone.core.config.WindowsAppConfig
import id.wphone.core.input.JoiPlayGamepadOverlay
import id.wphone.core.input.UnifiedQwertyDesktopKeyboard
import id.wphone.core.runtime.LiveSystemTelemetry
import id.wphone.core.runtime.SystemTelemetryReader
import id.wphone.core.runtime.WineProcessRunner
import kotlinx.coroutines.delay
import kotlinx.serialization.json.Json
import java.io.File

class WineWorkspaceActivity : ComponentActivity() {

    companion object {
        const val EXTRA_APP_JSON = "wphone_app_json"
    }

    private lateinit var processRunner: WineProcessRunner
    private var surfaceViewRef: XServerSurfaceView? = null

    private fun applyRequestedOrientation(mode: OrientationMode) {
        requestedOrientation = when (mode) {
            OrientationMode.DYNAMIC_AUTO -> ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
            OrientationMode.LANDSCAPE -> ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
            OrientationMode.PORTRAIT -> ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        hideSystemBars()

        val wphoneApp = application as WPhoneApplication
        val caps = wphoneApp.deviceAnalyzer.analyze()
        val persisted = wphoneApp.repository.loadState(caps)
        applyRequestedOrientation(persisted.orientationMode)

        val rawJson = intent.getStringExtra(EXTRA_APP_JSON)
        val appConfig = rawJson?.let {
            runCatching { Json { ignoreUnknownKeys = true }.decodeFromString<WindowsAppConfig>(it) }.getOrNull()
        } ?: WindowsAppConfig(
            id = "wine-notepad",
            name = "Wine Notepad (Built-in)",
            category = "Utilities",
            executablePath = "C:\\windows\\system32\\notepad.exe",
            workingDirectory = "C:\\windows\\system32",
            prefixId = "pfx-notepad",
            resolution = caps.memoryBudget.maxVirtualResolution
        )

        val parts = appConfig.resolution.lowercase().split("x")
        val initialFbW = parts.getOrNull(0)?.toIntOrNull()?.coerceIn(640, 1920) ?: 1280
        val initialFbH = parts.getOrNull(1)?.toIntOrNull()?.coerceIn(360, 1080) ?: 720

        val socketFile = File(File(wphoneApp.runtimeManager.tmpDir(), ".X11-unix").apply { mkdirs() }, "X0")
        val xStarted = WPhoneNativeBridge.xserverStart(socketFile.absolutePath, initialFbW, initialFbH)

        processRunner = WineProcessRunner(this, wphoneApp.runtimeManager, wphoneApp.prefixManager.prefixesDir())
        val hive = wphoneApp.repository.readPrefixHive(appConfig.prefixId)

        var menuOpen by mutableStateOf(false)
        var overlayMode by mutableStateOf(
            if (appConfig.keyboardMode == "gaming") OverlayMode.GAMEPAD else OverlayMode.HIDDEN
        )
        var logsVisible by mutableStateOf(false)
        var trackpadMode by mutableStateOf(false)
        var processAlive by mutableStateOf(true)
        var orientationMode by mutableStateOf(persisted.orientationMode)
        var safeModeEnabled by mutableStateOf(persisted.globalBox64SafeMode || appConfig.box64SafeMode)
        var inputPreset by mutableStateOf(persisted.inputPreset)
        var activeFbW by mutableIntStateOf(initialFbW)
        var activeFbH by mutableIntStateOf(initialFbH)
        var exitStatusText by mutableStateOf(
            if (xStarted) "Running on X11 :0 (${initialFbW}x${initialFbH})" else "XServer socket init failed"
        )
        val logLines = mutableStateListOf<String>()

        fun startWineProcess(width: Int, height: Int, safe: Boolean) {
            if (!xStarted) {
                processAlive = false
                logsVisible = true
                return
            }
            processAlive = true
            exitStatusText = "Running on X11 :0 (${width}x${height})"
            val launchRes = processRunner.start(
                app = appConfig.copy(box64SafeMode = safe),
                caps = caps,
                registryOverrides = hive.toWineDllOverridesEnv(),
                fbWidth = width,
                fbHeight = height,
                globalSafeMode = safe,
                onLogLine = { line ->
                    runOnUiThread {
                        if (logLines.size >= 300) logLines.removeAt(0)
                        logLines.add(line)
                    }
                },
                onExit = { code ->
                    runOnUiThread {
                        processAlive = false
                        exitStatusText = "Exited ($code)"
                    }
                }
            )
            launchRes.onFailure { err ->
                processAlive = false
                exitStatusText = err.message ?: "Failed to launch Wine/Box64"
                logLines.add("[error] ${err.message}")
                logsVisible = true
            }
        }

        startWineProcess(initialFbW, initialFbH, safeModeEnabled)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                menuOpen = !menuOpen
            }
        })

        setContent {
            var telemetry by remember { mutableStateOf<LiveSystemTelemetry?>(null) }
            var fps by remember { mutableIntStateOf(0) }

            LaunchedEffect(Unit) {
                while (true) {
                    telemetry = SystemTelemetryReader.read(this@WineWorkspaceActivity)
                    fps = WPhoneNativeBridge.xserverGetFps()
                    delay(1000L)
                }
            }

            MaterialTheme(colorScheme = darkColorScheme(primary = Color(0xFF38BDF8))) {
                BoxWithConstraints(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black)
                ) {
                    val isLandscape = maxWidth >= maxHeight
                    val targetW = if (isLandscape) {
                        if (caps.memoryBudget.isLowRamMode) 960 else 1280
                    } else {
                        if (caps.memoryBudget.isLowRamMode) 540 else 720
                    }
                    val targetH = if (isLandscape) {
                        if (caps.memoryBudget.isLowRamMode) 540 else 720
                    } else {
                        if (caps.memoryBudget.isLowRamMode) 960 else 1280
                    }

                    LaunchedEffect(targetW, targetH) {
                        if (targetW != activeFbW || targetH != activeFbH) {
                            activeFbW = targetW
                            activeFbH = targetH
                            WPhoneNativeBridge.xserverResize(targetW, targetH)
                            surfaceViewRef?.updateVirtualResolution(targetW, targetH)
                            exitStatusText = "Running on X11 :0 (${targetW}x${targetH})"
                        }
                    }

                    AndroidView(
                        modifier = Modifier.fillMaxSize(),
                        factory = { ctx ->
                            XServerSurfaceView(ctx, activeFbW, activeFbH).also { view ->
                                view.trackpadMode = trackpadMode
                                surfaceViewRef = view
                            }
                        },
                        update = { view ->
                            view.trackpadMode = trackpadMode
                            view.updateVirtualResolution(activeFbW, activeFbH)
                        }
                    )

                    // JoiPlay Gamepad full-screen transparent overlay (when GAMEPAD active)
                    if (overlayMode == OverlayMode.GAMEPAD) {
                        JoiPlayGamepadOverlay(
                            preset = inputPreset,
                            onDispatchKey = { key, ctrl, alt, shift ->
                                when (key.uppercase()) {
                                    "ARROWS" -> Unit
                                    "WASD" -> Unit
                                    "MOUSE" -> Unit
                                    else -> XKeyMapper.dispatchVirtualCombo(key, ctrl, alt, shift)
                                }
                            },
                            onMovePointer = { dx, dy ->
                                surfaceViewRef?.moveRelativePointer(dx, dy)
                            },
                            modifier = Modifier
                                .fillMaxSize()
                                .safeDrawingPadding()
                        )
                    }

                    // Top-right HUD: Mini CPU/RAM/FPS Monitor + Input Switch + Menu + Direct 1-Tap Red Exit
                    Column(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .safeDrawingPadding()
                            .padding(8.dp),
                        horizontalAlignment = Alignment.End,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Mini Telemetry Monitor HUD
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = Color(0xFF0B1120).copy(alpha = 0.85f),
                                border = BorderStroke(1.dp, Color(0xFF1E293B))
                            ) {
                                Text(
                                    text = "CPU ${telemetry?.cpuPercent ?: 0}% · ${telemetry?.ramUsedMb ?: 0}MB · ${fps}FPS",
                                    color = Color(0xFF38BDF8),
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Medium,
                                    fontFamily = FontFamily.Monospace,
                                    modifier = Modifier.padding(horizontal = 9.dp, vertical = 7.dp)
                                )
                            }

                            // Cycle Overlay Mode (Hidden -> Unified Keyboard -> JoiPlay Gamepad -> Hidden)
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = if (overlayMode != OverlayMode.HIDDEN) Color(0xFF0078D4).copy(alpha = 0.90f)
                                else Color(0xFF0B1120).copy(alpha = 0.85f),
                                border = BorderStroke(1.dp, Color(0xFF334155)),
                                onClick = {
                                    overlayMode = when (overlayMode) {
                                        OverlayMode.HIDDEN -> OverlayMode.KEYBOARD
                                        OverlayMode.KEYBOARD -> OverlayMode.GAMEPAD
                                        OverlayMode.GAMEPAD -> OverlayMode.HIDDEN
                                    }
                                }
                            ) {
                                Box(modifier = Modifier.padding(8.dp)) {
                                    Icon(
                                        if (overlayMode == OverlayMode.GAMEPAD) Icons.Default.Gamepad else Icons.Default.Keyboard,
                                        contentDescription = "Cycle Keyboard / Gamepad",
                                        tint = Color.White,
                                        modifier = Modifier.size(20.dp)
                                    )
                                }
                            }

                            // Workspace Menu Toggle
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = Color(0xFF0B1120).copy(alpha = 0.85f),
                                border = BorderStroke(1.dp, Color(0xFF334155)),
                                onClick = { menuOpen = !menuOpen }
                            ) {
                                Box(modifier = Modifier.padding(8.dp)) {
                                    Icon(
                                        if (menuOpen) Icons.Default.Close else Icons.Default.Menu,
                                        contentDescription = "Workspace Menu",
                                        tint = Color.White,
                                        modifier = Modifier.size(20.dp)
                                    )
                                }
                            }

                            // Prominent 1-Tap Exit App Button (always reachable above TextureView)
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = Color(0xFFDC2626),
                                onClick = { exitWorkspace() }
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 9.dp, vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Icon(Icons.Default.ExitToApp, contentDescription = "Exit App", tint = Color.White, modifier = Modifier.size(18.dp))
                                    Text("Exit", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                }
                            }
                        }

                        if (menuOpen) {
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = Color(0xFF0B1120).copy(alpha = 0.96f),
                                border = BorderStroke(1.dp, Color(0xFF334155)),
                                modifier = Modifier.width(290.dp)
                            ) {
                                Column(
                                    modifier = Modifier.padding(12.dp),
                                    verticalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Text(appConfig.name, style = MaterialTheme.typography.titleSmall, color = Color.White)
                                    Text(
                                        if (processAlive) exitStatusText else "Stopped: $exitStatusText",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = Color(0xFF94A3B8),
                                        fontFamily = FontFamily.Monospace
                                    )

                                    // Overlay Mode Switcher
                                    Text("Input Overlay Mode", style = MaterialTheme.typography.labelSmall, color = Color(0xFF94A3B8))
                                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                                        FilterChip(
                                            selected = overlayMode == OverlayMode.HIDDEN,
                                            onClick = { overlayMode = OverlayMode.HIDDEN; menuOpen = false },
                                            label = { Text("Off", fontSize = 11.sp) }
                                        )
                                        FilterChip(
                                            selected = overlayMode == OverlayMode.KEYBOARD,
                                            onClick = { overlayMode = OverlayMode.KEYBOARD; menuOpen = false },
                                            label = { Text("QWERTY+PC", fontSize = 11.sp) }
                                        )
                                        FilterChip(
                                            selected = overlayMode == OverlayMode.GAMEPAD,
                                            onClick = { overlayMode = OverlayMode.GAMEPAD; menuOpen = false },
                                            label = { Text("Gamepad", fontSize = 11.sp) }
                                        )
                                    }

                                    // Gamepad Skin Switcher
                                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                                        FilterChip(
                                            selected = inputPreset.skin == GamepadSkin.PLAYSTATION,
                                            onClick = {
                                                val updated = inputPreset.copy(
                                                    skin = GamepadSkin.PLAYSTATION,
                                                    buttons = inputPreset.buttons.map { b ->
                                                        when (b.id) {
                                                            "btn-top" -> b.copy(label = "△")
                                                            "btn-right" -> b.copy(label = "○")
                                                            "btn-bottom" -> b.copy(label = "×")
                                                            "btn-left" -> b.copy(label = "□")
                                                            else -> b
                                                        }
                                                    }
                                                )
                                                inputPreset = updated
                                                val latest = wphoneApp.repository.loadState(caps)
                                                wphoneApp.repository.saveState(latest.copy(inputPreset = updated))
                                            },
                                            label = { Text("PS (△○×□)", fontSize = 11.sp) }
                                        )
                                        FilterChip(
                                            selected = inputPreset.skin == GamepadSkin.NINTENDO,
                                            onClick = {
                                                val updated = inputPreset.copy(
                                                    skin = GamepadSkin.NINTENDO,
                                                    buttons = inputPreset.buttons.map { b ->
                                                        when (b.id) {
                                                            "btn-top" -> b.copy(label = "X")
                                                            "btn-right" -> b.copy(label = "A")
                                                            "btn-bottom" -> b.copy(label = "B")
                                                            "btn-left" -> b.copy(label = "Y")
                                                            else -> b
                                                        }
                                                    }
                                                )
                                                inputPreset = updated
                                                val latest = wphoneApp.repository.loadState(caps)
                                                wphoneApp.repository.saveState(latest.copy(inputPreset = updated))
                                            },
                                            label = { Text("Nintendo (XABY)", fontSize = 11.sp) }
                                        )
                                    }

                                    OutlinedButton(
                                        onClick = {
                                            surfaceViewRef?.let { view ->
                                                view.requestFocus()
                                                val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
                                                imm.showSoftInput(view, InputMethodManager.SHOW_IMPLICIT)
                                            }
                                            menuOpen = false
                                        },
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Icon(Icons.Default.Keyboard, contentDescription = null, modifier = Modifier.size(16.dp))
                                        Spacer(Modifier.width(8.dp))
                                        Text("Open System QWERTY")
                                    }

                                    OutlinedButton(
                                        onClick = { trackpadMode = !trackpadMode },
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Icon(Icons.Default.Mouse, contentDescription = null, modifier = Modifier.size(16.dp))
                                        Spacer(Modifier.width(8.dp))
                                        Text(if (trackpadMode) "Touch: Trackpad" else "Touch: Direct Mouse")
                                    }

                                    // Dynamic Rotation Cycle
                                    OutlinedButton(
                                        onClick = {
                                            val next = when (orientationMode) {
                                                OrientationMode.DYNAMIC_AUTO -> OrientationMode.LANDSCAPE
                                                OrientationMode.LANDSCAPE -> OrientationMode.PORTRAIT
                                                OrientationMode.PORTRAIT -> OrientationMode.DYNAMIC_AUTO
                                            }
                                            orientationMode = next
                                            applyRequestedOrientation(next)
                                            val latest = wphoneApp.repository.loadState(caps)
                                            wphoneApp.repository.saveState(latest.copy(orientationMode = next))
                                        },
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Icon(Icons.Default.ScreenRotation, contentDescription = null, modifier = Modifier.size(16.dp))
                                        Spacer(Modifier.width(8.dp))
                                        val rotLabel = when (orientationMode) {
                                            OrientationMode.DYNAMIC_AUTO -> "Rotation: Dynamic Auto"
                                            OrientationMode.LANDSCAPE -> "Rotation: Landscape"
                                            OrientationMode.PORTRAIT -> "Rotation: Portrait"
                                        }
                                        Text(rotLabel)
                                    }

                                    // Box64 Safe Mode Toggle + Restart
                                    OutlinedButton(
                                        onClick = {
                                            val nextSafe = !safeModeEnabled
                                            safeModeEnabled = nextSafe
                                            startWineProcess(activeFbW, activeFbH, nextSafe)
                                            menuOpen = false
                                        },
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Icon(Icons.Default.RestartAlt, contentDescription = null, modifier = Modifier.size(16.dp))
                                        Spacer(Modifier.width(8.dp))
                                        Text(if (safeModeEnabled) "Safe Mode ON · Restart" else "Safe Mode (Fix 139) · Restart")
                                    }

                                    OutlinedButton(
                                        onClick = {
                                            logsVisible = !logsVisible
                                            menuOpen = false
                                        },
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Icon(Icons.Default.Terminal, contentDescription = null, modifier = Modifier.size(16.dp))
                                        Spacer(Modifier.width(8.dp))
                                        Text(if (logsVisible) "Hide Logs" else "Process Logs (${logLines.size})")
                                    }

                                    Button(
                                        onClick = { exitWorkspace() },
                                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Icon(Icons.Default.ExitToApp, contentDescription = null, modifier = Modifier.size(18.dp))
                                        Spacer(Modifier.width(8.dp))
                                        Text("Exit App")
                                    }
                                }
                            }
                        }
                    }

                    // Optional real-time PRoot/Box64/Wine log panel
                    if (logsVisible) {
                        Surface(
                            modifier = Modifier
                                .align(Alignment.CenterStart)
                                .safeDrawingPadding()
                                .padding(12.dp)
                                .widthIn(max = 420.dp)
                                .fillMaxWidth(0.85f)
                                .fillMaxHeight(0.72f),
                            shape = RoundedCornerShape(12.dp),
                            color = Color(0xFF0B1120).copy(alpha = 0.94f),
                            border = BorderStroke(1.dp, Color(0xFF334155))
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text("Runtime Output (PRoot + Box64 + Wine)", style = MaterialTheme.typography.titleSmall, color = Color.White)
                                    IconButton(onClick = { logsVisible = false }) {
                                        Icon(Icons.Default.Close, contentDescription = "Close Logs", tint = Color.White)
                                    }
                                }
                                HorizontalDivider(color = Color(0xFF1E293B))
                                LazyColumn(modifier = Modifier.weight(1f).padding(top = 6.dp)) {
                                    items(logLines) { line ->
                                        Text(
                                            line,
                                            color = Color(0xFFCBD5E1),
                                            style = MaterialTheme.typography.labelSmall,
                                            fontFamily = FontFamily.Monospace
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // Unified Desktop + QWERTY Keyboard Panel
                    if (overlayMode == OverlayMode.KEYBOARD) {
                        UnifiedQwertyDesktopKeyboard(
                            preset = inputPreset,
                            onDispatchKey = { key, ctrl, alt, shift ->
                                XKeyMapper.dispatchVirtualCombo(key, ctrl, alt, shift)
                            },
                            onOpenSystemIme = {
                                surfaceViewRef?.let { view ->
                                    view.requestFocus()
                                    val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
                                    imm.showSoftInput(view, InputMethodManager.SHOW_IMPLICIT)
                                }
                            },
                            onHide = { overlayMode = OverlayMode.HIDDEN },
                            modifier = Modifier
                                .align(Alignment.BottomCenter)
                                .safeDrawingPadding()
                        )
                    }
                }
            }
        }
    }

    private fun hideSystemBars() {
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        controller.hide(WindowInsetsCompat.Type.systemBars())
    }

    private fun exitWorkspace() {
        processRunner.stop()
        WPhoneNativeBridge.xserverStop()
        finish()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    override fun onDestroy() {
        processRunner.stop()
        WPhoneNativeBridge.xserverStop()
        super.onDestroy()
    }
}
