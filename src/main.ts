import { createApp } from "vue";
import App from "./App.vue";

import { ElButton,ElUpload,ElSlider,ElDialog,
    ElForm,
    ElFormItem,
    ElInput,
    ElDivider,
    ElInputNumber, } from 'element-plus'

const app = createApp(App);
app.component('ElButton', ElButton);
app.component('ElUpload', ElUpload);
app.component('ElSlider', ElSlider);
app.component('ElDialog', ElDialog);
app.component('ElForm', ElForm);
app.component('ElFormItem', ElFormItem);
app.component('ElInput', ElInput);
app.component('ElDivider', ElDivider);
app.component('ElInputNumber', ElInputNumber);
app.mount("#app");
