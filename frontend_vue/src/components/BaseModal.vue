<template>
  <Teleport to="body">
    <div class="modal-backdrop" @mousedown.self="$emit('close')">
      <section :class="['base-modal', sizeClass]" role="dialog" aria-modal="true" :aria-label="title">
        <button type="button" class="modal-close" aria-label="닫기" @click="$emit('close')"><X :size="19" /></button>
        <slot />
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted } from "vue";
import { X } from "lucide-vue-next";

const props = defineProps({ title: { type: String, default: "팝업" }, size: { type: String, default: "medium" } });
defineEmits(["close"]);
const sizeClass = computed(() => `modal-${props.size}`);
onMounted(() => document.body.classList.add("modal-open"));
onBeforeUnmount(() => document.body.classList.remove("modal-open"));
</script>
