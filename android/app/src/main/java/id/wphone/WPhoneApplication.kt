package id.wphone

import android.app.Application
import android.view.Surface
import id.wphone.core.config.DeviceCapabilityAnalyzer
import id.wphone.core.diagnostics.ProtectedFileManager
import id.wphone.core.plugin.WrPluginManager
import id.wphone.core.prefix.PrefixManager
import id.wphone.core.runtime.RuntimeManager
import java.io.File

object WPhoneNativeBridge {
    init {
        System.loadLibrary("wphone_native")
    }

    external fun getNativeAbiInfo(): String
    external fun getRecommendedAudioBackend(preferLightweight: Boolean): String
    external fun getHostPageSizeKb(): Int
    external fun terminateProcessGracefully(pid: Int): Int

    external fun xserverStart(socketPath: String, width: Int, height: Int): Boolean
    external fun xserverSetSurface(surface: Surface?)
    external fun xserverResize(width: Int, height: Int)
    external fun xserverStop()
    external fun xserverInjectPointer(x: Int, y: Int, button: Int, action: Int, modifiers: Int)
    external fun xserverInjectKey(xKeycode: Int, isDown: Boolean, stateMask: Int)
    external fun xserverGetClientCount(): Int
    external fun xserverGetFps(): Int
}

class WPhoneApplication : Application() {
    lateinit var wphoneRoot: File
        private set
    lateinit var deviceAnalyzer: DeviceCapabilityAnalyzer
        private set
    lateinit var runtimeManager: RuntimeManager
        private set
    lateinit var prefixManager: PrefixManager
        private set
    lateinit var pluginManager: WrPluginManager
        private set
    lateinit var fileGuard: ProtectedFileManager
        private set
    lateinit var repository: WPhoneRepository
        private set

    override fun onCreate() {
        super.onCreate()
        wphoneRoot = File(filesDir, "WPhone").apply { mkdirs() }
        File(wphoneRoot, "config").mkdirs()
        File(wphoneRoot, "imports").mkdirs()
        File(wphoneRoot, "logs").mkdirs()
        File(wphoneRoot, "tmp/.X11-unix").mkdirs()

        deviceAnalyzer = DeviceCapabilityAnalyzer(this)
        runtimeManager = RuntimeManager(wphoneRoot)
        prefixManager = PrefixManager(wphoneRoot)
        pluginManager = WrPluginManager(File(wphoneRoot, "plugins").apply { mkdirs() })
        fileGuard = ProtectedFileManager(wphoneRoot)
        repository = WPhoneRepository(this, wphoneRoot, prefixManager, deviceAnalyzer)
    }
}
