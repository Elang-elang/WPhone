package id.wphone

import android.content.Context
import android.content.pm.ActivityInfo
import android.os.Bundle
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Keyboard
import androidx.compose.material.icons.filled.KeyboardHide
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Mouse
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import id.wphone.core.config.WindowsAppConfig
import id.wphone.core.input.DesktopModifierBar
import id.wphone.core.input.GamingVirtualPadBar
import id.wphone.core.runtime.WineProcessRunner
import kotlinx.serialization.json.Json
import java.io.File

class WineWorkspaceActivity : ComponentActivity() {

    companion object {
        const val EXTRA_APP_JSON = "wphone_app_json"
    }

    private lateinit var processRunner: WineProcessRunner
    private var surfaceViewRef: XServerSurfaceView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        hideSystemBars()

        val wphoneApp = application as WPhoneApplication
        val caps = wphoneApp.deviceAnalyzer.analyze()
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
        val fbWidth = parts.getOrNull(0)?.toIntOrNull()?.coerceIn(640, 1920) ?: 1280
        val fbHeight = parts.getOrNull(1)?.toIntOrNull()?.coerceIn(360, 1080) ?: 720

        val socketFile = File(File(wphoneApp.runtimeManager.tmpDir(), ".X11-unix").apply { mkdirs() }, "X0")
        val xStarted = WPhoneNativeBridge.xserverStart(socketFile.absolutePath, fbWidth, fbHeight)

        processRunner = WineProcessRunner(this, wphoneApp.runtimeManager, wphoneApp.prefixManager.prefixesDir())
        val hive = wphoneApp.repository.readPrefixHive(appConfig.prefixId)

        var menuOpen by mutableStateOf(false)
        var keyboardVisible by mutableStateOf(false)
        var logsVisible by mutableStateOf(false)
        var trackpadMode by mutableStateOf(false)
        var processAlive by mutableStateOf(true)
        var exitStatusText by mutableStateOf(if (xStarted) "Running on X11 :0 (${fbWidth}x${fbHeight})" else "XServer socket init failed")
        val logLines = mutableStateListOf<String>()

        if (xStarted) {
            val launchRes = processRunner.start(
                app = appConfig,
                caps = caps,
                registryOverrides = hive.toWineDllOverridesEnv(),
                fbWidth = fbWidth,
                fbHeight = fbHeight,
                onLogLine = { line ->
                    runOnUiThread {
                        if (logLines.size >= 250) logLines.removeAt(0)
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
        } else {
            processAlive = false
            logsVisible = true
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                menuOpen = !menuOpen
            }
        })

        setContent {
            MaterialTheme(colorScheme = darkColorScheme(primary = Color(0xFF38BDF8))) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black)
                ) {
                    AndroidView(
                        modifier = Modifier.fillMaxSize(),
                        factory = { ctx ->
                            XServerSurfaceView(ctx, fbWidth, fbHeight).also { view ->
                                view.trackpadMode = trackpadMode
                                surfaceViewRef = view
                            }
                        },
                        update = { view ->
                            view.trackpadMode = trackpadMode
                        }
                    )

                    // Unobtrusive top-right corner menu handle
                    Column(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(10.dp),
                        horizontalAlignment = Alignment.End,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = Color(0xFF0F172A).copy(alpha = 0.78f),
                                onClick = { keyboardVisible = !keyboardVisible }
                            ) {
                                Box(modifier = Modifier.padding(10.dp)) {
                                    Icon(
                                        if (keyboardVisible) Icons.Default.KeyboardHide else Icons.Default.Keyboard,
                                        contentDescription = "Toggle Virtual Keyboard",
                                        tint = if (keyboardVisible) Color(0xFF38BDF8) else Color.White,
                                        modifier = Modifier.size(20.dp)
                                    )
                                }
                            }
                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = Color(0xFF0F172A).copy(alpha = 0.78f),
                                onClick = { menuOpen = !menuOpen }
                            ) {
                                Box(modifier = Modifier.padding(10.dp)) {
                                    Icon(
                                        if (menuOpen) Icons.Default.Close else Icons.Default.Menu,
                                        contentDescription = "Workspace Menu",
                                        tint = Color.White,
                                        modifier = Modifier.size(20.dp)
                                    )
                                }
                            }
                        }

                        if (menuOpen) {
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = Color(0xFF0F172A).copy(alpha = 0.94f),
                                tonalElevation = 6.dp,
                                modifier = Modifier.width(260.dp)
                            ) {
                                Column(
                                    modifier = Modifier.padding(12.dp),
                                    verticalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Text(
                                        appConfig.name,
                                        style = MaterialTheme.typography.titleSmall,
                                        color = Color.White
                                    )
                                    Text(
                                        if (processAlive) exitStatusText else "Stopped: $exitStatusText",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = Color(0xFF94A3B8),
                                        fontFamily = FontFamily.Monospace
                                    )

                                    OutlinedButton(
                                        onClick = {
                                            keyboardVisible = !keyboardVisible
                                            menuOpen = false
                                        },
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Icon(Icons.Default.Keyboard, contentDescription = null, modifier = Modifier.size(18.dp))
                                        Spacer(Modifier.width(8.dp))
                                        Text(if (keyboardVisible) "Hide Keyboard Bar" else "Show Keyboard Bar")
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
                                        Icon(Icons.Default.Keyboard, contentDescription = null, modifier = Modifier.size(18.dp))
                                        Spacer(Modifier.width(8.dp))
                                        Text("Open System QWERTY")
                                    }

                                    OutlinedButton(
                                        onClick = { trackpadMode = !trackpadMode },
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Icon(Icons.Default.Mouse, contentDescription = null, modifier = Modifier.size(18.dp))
                                        Spacer(Modifier.width(8.dp))
                                        Text(if (trackpadMode) "Touch: Trackpad" else "Touch: Direct Mouse")
                                    }

                                    OutlinedButton(
                                        onClick = {
                                            logsVisible = !logsVisible
                                            menuOpen = false
                                        },
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Icon(Icons.Default.Terminal, contentDescription = null, modifier = Modifier.size(18.dp))
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
                                .padding(14.dp)
                                .width(420.dp)
                                .fillMaxHeight(0.75f),
                            shape = RoundedCornerShape(12.dp),
                            color = Color(0xFF0B1120).copy(alpha = 0.92f)
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

                    // Collapsible bottom virtual keyboard overlay
                    if (keyboardVisible) {
                        Column(
                            modifier = Modifier
                                .align(Alignment.BottomCenter)
                                .fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(Color(0xFF020617).copy(alpha = 0.85f))
                                    .padding(horizontal = 8.dp, vertical = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                TextButton(onClick = {
                                    surfaceViewRef?.let { view ->
                                        view.requestFocus()
                                        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
                                        imm.showSoftInput(view, InputMethodManager.SHOW_IMPLICIT)
                                    }
                                }) {
                                    Text("Type QWERTY (IME)", color = Color(0xFF38BDF8))
                                }
                                TextButton(onClick = { keyboardVisible = false }) {
                                    Text("Hide Keyboard", color = Color(0xFF94A3B8))
                                }
                            }
                            if (appConfig.keyboardMode == "gaming") {
                                GamingVirtualPadBar(alphaLevel = 0.90f) { key, ctrl, alt, shift ->
                                    XKeyMapper.dispatchVirtualCombo(key, ctrl, alt, shift)
                                }
                            } else {
                                DesktopModifierBar(alphaLevel = 0.90f) { key, ctrl, alt, shift ->
                                    XKeyMapper.dispatchVirtualCombo(key, ctrl, alt, shift)
                                }
                            }
                        }
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
