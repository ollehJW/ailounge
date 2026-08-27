<template>
  <div class="portal-shell">
    <header class="portal-header">
      <div class="portal-header-inner">
        <RouterLink class="portal-brand" to="/aistudio/intro" aria-label="WIA AI Lounge 홈">
          <img src="../assets/logo-header.png" alt="WIA" />
        </RouterLink>
        <nav class="portal-nav" aria-label="주 메뉴">
          <div v-for="section in menu.sections" :key="section.id" class="portal-nav-root">
            <RouterLink :to="section.home" v-on:click="releaseMenuFocus" :class="['portal-nav-trigger', { active: route.meta.section === section.id }]">{{ section.label }}</RouterLink>
            <div class="portal-submenu">
              <div class="portal-submenu-inner">
                <div class="portal-submenu-summary">
                  <span>{{ section.label }}</span>
                  <strong>{{ section.heading }}</strong>
                  <p>{{ section.description }}</p>
                </div>
                <div class="portal-submenu-links">
                  <RouterLink v-for="item in section.items" :key="item.to" :to="item.to" v-on:click="releaseMenuFocus"><span>{{ item.eyebrow }}</span><strong>{{ item.label }}</strong><p>{{ item.description }}</p></RouterLink>
                </div>
              </div>
            </div>
          </div>
        </nav>
        <div class="portal-account">
          <span class="portal-user-avatar" aria-hidden="true"></span>
          <strong>{{ auth.user?.displayed_name }} {{ auth.user?.job_title }} 님</strong>
        </div>
      </div>
    </header>

    <main class="portal-main">
      <div class="portal-contents-top">
        <nav class="portal-breadcrumbs" aria-label="현재 위치">
          <ol>
            <li><RouterLink to="/aistudio/intro" aria-label="홈"><House :size="17" /></RouterLink></li>
            <li><ChevronRight :size="14" /><span>{{ route.meta.sectionLabel }}</span></li>
            <li><ChevronRight :size="14" /><strong>{{ route.meta.title }}</strong></li>
          </ol>
        </nav>
        <section v-if="route.name !== 'studio-intro'" :class="['page-heading-band', 'section-' + (route.meta.section || 'community')]">
          <div class="page-heading-inner">
            <h1>{{ route.meta.title }}</h1>
            <p>{{ route.meta.description }}</p>
          </div>
        </section>
      </div>
      <div class="portal-content"><slot /></div>
    </main>

    <footer class="portal-footer">
      <div class="portal-footer-inner">
        <img src="../assets/logo-footer.png" alt="HYUNDAI WIA" />
        <p>COPYRIGHT &copy; HYUNDAI WIA CORP. ALL RIGHTS RESERVED.</p>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ChevronRight, House } from "@/icons/lucide";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useMenuStore } from "@/stores/menu";

const route = useRoute();
const auth = useAuthStore();
const menu = useMenuStore();
const releaseMenuFocus = (event) => event.currentTarget?.blur();

</script>
