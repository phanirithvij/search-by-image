import {targetEnv} from 'utils/config';

var contentStorage = {
  viewFrame: null,
  viewFrameId: 0,
  viewMessagePort: null,
  queuedMessage: null
};

function showView(view) {
  const currentView = contentStorage.viewFrame.id;
  if (currentView !== view) {
    contentStorage.viewFrameId = 0;
    contentStorage.viewMessagePort = null;

    if (currentView) {
      window.setTimeout(function () {
        contentStorage.viewFrame.id = view;
      }, 100);

      browser.runtime.sendMessage({
        id: 'discardView',
        view: currentView
      });
    } else {
      contentStorage.viewFrame.id = view;
    }

    contentStorage.viewFrame.src = browser.runtime.getURL(
      `/src/${view}/index.html`
    );
  }

  contentStorage.viewFrame.classList.remove('hidden');
}

function hideView(view) {
  window.setTimeout(function () {
    if (contentStorage.viewFrame.id === view) {
      contentStorage.viewFrame.classList.add('hidden');
      document.body.focus();
    }
  }, 300);
}

function sendQueuedMessage() {
  if (contentStorage.queuedMessage) {
    messageView(contentStorage.queuedMessage);
    contentStorage.queuedMessage = null;
  }
}

function messageView(message) {
  if (contentStorage.viewFrameId) {
    browser.runtime.sendMessage({
      id: 'routeMessage',
      messageFrameId: contentStorage.viewFrameId,
      message
    });
  } else if (contentStorage.viewMessagePort) {
    contentStorage.viewMessagePort.postMessage(message);
  } else {
    contentStorage.queuedMessage = message;
  }
}

function onMessage(request, sender) {
  // Samsung Internet 13: extension messages are sometimes also dispatched
  // to the sender frame.
  if (sender.url === document.URL) {
    return;
  }

  if (request.id === 'openView') {
    showView(request.view);
    messageView(request);
  } else if (request.id === 'closeView') {
    if (request.messageView) {
      messageView({id: request.id});
    }
    hideView(request.view);
  } else if (request.id === 'messageView') {
    const message = request.message;
    if (request.flattenMessage) {
      delete request.id;
      delete request.message;
      delete request.flattenMessage;
      Object.assign(message, request);
    }
    messageView(message);
  } else if (request.id === 'saveFrameId') {
    contentStorage.viewFrameId = request.senderFrameId;
    sendQueuedMessage();
  }
}

function onConnect(messagePort) {
  contentStorage.viewMessagePort = messagePort;
  sendQueuedMessage();
}

self.initContent = function () {
  const shadowHost = document.createElement('div');
  const shadowRoot = shadowHost.attachShadow({mode: 'closed'});

  const css = document.createElement('link');
  css.setAttribute('rel', 'stylesheet');
  css.setAttribute('href', browser.runtime.getURL('/src/content/style.css'));
  shadowRoot.appendChild(css);

  const viewFrame = document.createElement('iframe');
  viewFrame.classList.add('hidden');

  css.addEventListener('load', () => shadowRoot.appendChild(viewFrame), {
    once: true
  });

  document.body.appendChild(shadowHost);

  contentStorage.viewFrame = viewFrame;

  browser.runtime.onMessage.addListener(onMessage);
  if (targetEnv === 'safari') {
    browser.runtime.onConnect.addListener(onConnect);
  }
};

initContent();
