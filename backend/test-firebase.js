"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const firebase_1 = require("./src/services/firebase");
console.log("Firebase initialized:", firebase_1.initialized);
if (firebase_1.auth) {
    console.log("Auth is present");
}
else {
    console.log("Auth is NOT present");
}
//# sourceMappingURL=test-firebase.js.map