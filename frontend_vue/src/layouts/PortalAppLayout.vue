<template>
  <div class="portal-shell portal-shell-gnb">
    <header class="portal-header portal-header-gnb">
      <div class="portal-header-inner">
        <RouterLink class="portal-brand" to="/aistudio" aria-label="WIA AI Lounge 홈">
          <img src="../assets/logo-header.png" alt="WIA" />
        </RouterLink>
        <nav class="portal-nav portal-gnb" aria-label="주 메뉴">
          <div v-for="section in menu.roleMenu" :key="section.menu_id" class="portal-nav-root">
            <RouterLink
              :to="firstMenuPath(section)"
              :class="['portal-nav-trigger', { active: isMenuActive(section) }]"
              @click="releaseMenuFocus"
            >{{ section.menu_name }}</RouterLink>
            <div class="portal-submenu">
              <div class="portal-submenu-inner">
                <dl class="portal-submenu-summary">
                  <dt>{{ section.menu_name }}</dt>
                  <dd>{{ section.menu_desc }}</dd>
                </dl>
                <ul class="portal-depth-2">
                  <li v-for="group in visibleChildren(section)" :key="group.menu_id">
                    <span>{{ group.menu_name }}</span>
                    <ul>
                      <li
                        v-for="item in visibleChildren(group)"
                        :key="item.menu_id"
                        :class="{ current: route.path === item.menu_path }"
                      >
                        <RouterLink :to="item.menu_path" @click="releaseMenuFocus">{{ item.menu_name }}</RouterLink>
                      </li>
                    </ul>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <button
            type="button"
            class="portal-sitemap-trigger"
            title="전체메뉴 열기"
            aria-label="전체메뉴 열기"
            @click="isSitemapOpen = true"
          ><span aria-hidden="true"></span></button>
        </nav>
        <div class="portal-account">
          <span class="portal-user-avatar" aria-hidden="true"></span>
          <strong>{{ auth.user?.displayed_name }} {{ auth.user?.job_title }} 님</strong>
          <button type="button" class="icon-button" title="로그아웃" aria-label="로그아웃" @click="handleLogout">
            <LogOut :size="18" />
          </button>
        </div>
      </div>
    </header>

    <div v-if="isSitemapOpen" class="portal-sitemap-backdrop" @click.self="isSitemapOpen = false">
      <section class="portal-sitemap" role="dialog" aria-modal="true" aria-label="전체메뉴">
        <header class="portal-sitemap-header">
          <strong>전체메뉴</strong>
          <button type="button" class="icon-button" title="전체메뉴 닫기" aria-label="전체메뉴 닫기" @click="isSitemapOpen = false">
            <X :size="20" />
          </button>
        </header>
        <div class="portal-sitemap-grid">
          <section v-for="section in menu.roleMenu" :key="section.menu_id">
            <h2>{{ section.menu_name }}</h2>
            <div v-for="group in visibleChildren(section)" :key="group.menu_id" class="portal-sitemap-group">
              <strong>{{ group.menu_name }}</strong>
              <RouterLink
                v-for="item in visibleChildren(group)"
                :key="item.menu_id"
                :to="item.menu_path"
                @click="isSitemapOpen = false"
              >{{ item.menu_name }}</RouterLink>
            </div>
          </section>
        </div>
      </section>
    </div>

    <main class="portal-main">
      <div class="portal-contents-top">
        <nav class="portal-breadcrumbs" aria-label="현재 위치">
          <ol>
            <li><RouterLink to="/aistudio" aria-label="홈"><House :size="17" /></RouterLink></li>
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
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ChevronRight, House, LogOut, X } from "@/icons/lucide";
import { useAuthStore } from "@/stores/auth";
import { useMenuStore } from "@/stores/menu";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const menu = useMenuStore();
const isSitemapOpen = ref(false);

const visibleChildren = (item) => (item?.child || []).filter((child) => child.menu_visible !== false);
const firstMenuPath = (item) => item?.menu_path || visibleChildren(item).map(firstMenuPath).find(Boolean) || "/aistudio";
const isMenuActive = (item) => item?.menu_path === route.path || visibleChildren(item).some(isMenuActive);
const releaseMenuFocus = (event) => event.currentTarget?.blur();

const handleLogout = () => {
  menu.clear();
  auth.logout();
  router.replace("/sign-in");
};
</script>
