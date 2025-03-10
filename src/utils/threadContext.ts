declare global {
  var currentThreadId: string | undefined;
}

export function setThreadContext(threadId: string) {
  global.currentThreadId = threadId;
}

export function clearThreadContext() {
  global.currentThreadId = undefined;
}
