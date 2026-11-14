pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "WPhone"
include(
    ":app",
    ":core-config",
    ":core-runtime",
    ":core-prefix",
    ":core-input",
    ":core-plugin",
    ":core-diagnostics"
)
