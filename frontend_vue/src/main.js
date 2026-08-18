import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import "./styles.css";
import "./styles/community.css";
import "./styles/forms.css";
import "./styles/studio.css";

createApp(App).use(createPinia()).use(router).mount("#app");
