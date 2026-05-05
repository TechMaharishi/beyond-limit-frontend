importScripts("https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCWIxS6qJpoRN108iCrpUoUG2KvdMZ17sc",
  authDomain: "blpt-be0f8.firebaseapp.com",
  projectId: "blpt-be0f8",
  storageBucket: "blpt-be0f8.firebasestorage.app",
  messagingSenderId: "620378812855",
  appId: "1:620378812855:web:3a86598c52242206f8b832",
});

const messaging = firebase.messaging();

// Handle background messages (when tab is not in focus)
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "New notification";
  const options = {
    body: payload.notification?.body || "",
    icon: "/logo.png",
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});
