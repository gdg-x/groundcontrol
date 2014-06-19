var appWindow;
var appOrigin;

function messageApp(msg) {
    if (!appWindow || !appOrigin) {
      log('Don\'t know where to send messages to, app hasn\'t initialized us yet.');
      return;
    }
    appWindow.postMessage(msg, appOrigin);
}

function log(msg) {
  messageApp({ type: "log", payload: msg });
}

function listener(event) {

	  if (event.origin.indexOf('chrome-extension://mkocgjlgmonoobpghannondgloaelfdn') != 0) {
      return;
    }

    // first message, store appWindow and appOrigin
    if (!appWindow || !appOrigin) {
      appWindow = event.source;
      appOrigin = event.origin;
    }

    log(event.origin);

    if(event.data.type == "start") {
      if(event.data.payload.payload.uri)
        document.getElementById("dragons").innerHTML = event.data.payload.payload.uri;
      else
        document.getElementById("dragons").innerHTML = "invalid payload";
      messageApp({ type: "started", msg: "easy going" });

      setTimeout(function() {
        // Time to go
        messageApp({ type: "finished", msg: ""});
      }, 10000);
    } else {
      messageApp({ type: "fail", msg: "no start params" });
    }
}

window.addEventListener('load', function() {
  window.addEventListener("message", listener, false)
  console.log("loaded...");
});
