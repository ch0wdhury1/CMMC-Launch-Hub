import admin from "firebase-admin";

export function getAdminApp() {
  if (admin.apps.length === 0) {
    admin.initializeApp();
  }
  return admin.app();
}
