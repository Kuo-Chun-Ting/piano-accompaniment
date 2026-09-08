<template>
  <main class="app-shell">
    <StudioToolbar />
    <div class="workspace">
      <AudioScoreWorkspace />
    </div>
  </main>
</template>

<style scoped>
:global(html),
:global(body) {
  margin: 0;
}
.app-shell {
  min-height: 100vh;
  background:
    radial-gradient(circle at 15% -10%, rgba(0, 0, 0, .035), transparent 29rem),
    #f5f5f7;
  color: #1d1d1f;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang TC", sans-serif;
  -webkit-font-smoothing: antialiased;
}
.app-shell,
.app-shell :deep(*) {
  box-sizing: border-box;
}
.app-shell > :deep(.studio-toolbar) { position: sticky; top: 0; z-index: 20; }
.workspace {
  display: grid;
  width: calc(100% - 48px);
  gap: 18px;
  margin: 30px auto 50px;
}
@media (max-width: 720px) {
  .workspace {
    width: calc(100% - 20px);
    margin-top: 18px;
  }
}
</style>
