plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "id.wphone.core.runtime"
    compileSdk = 35
    defaultConfig { minSdk = 24 }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation(project(":core-config"))
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("org.apache.commons:commons-compress:1.26.2")
    implementation("org.tukaani:xz:1.10")
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.2")
    testImplementation("junit:junit:4.13.2")
}
