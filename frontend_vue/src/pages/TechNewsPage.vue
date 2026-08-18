<template>
  <AppLayout>
    <div class="community-page news-page">
      <div class="section-toolbar">
        <div class="filter-tabs" role="tablist" aria-label="뉴스 유형">
          <button v-for="tab in tabs" :key="tab.value" type="button" :class="{ active: category === tab.value }" @click="category = tab.value">
            <span>{{ tab.label }}</span><b>{{ categoryCount(tab.value) }}</b>
          </button>
        </div>
        <label class="search-box"><Search :size="17" /><input v-model="query" type="search" placeholder="뉴스 제목을 검색하세요" /></label>
      </div>

      <p v-if="error" class="form-error page-error">{{ error }}</p>
      <div v-if="loading" class="content-state"><LoaderCircle class="spin" :size="28" /><span>뉴스를 불러오는 중입니다.</span></div>
      <div v-else-if="filteredNews.length" class="news-grid">
        <button v-for="item in filteredNews" :key="item.news_id" type="button" class="news-card" @click="openNews(item)">
          <div class="news-cover">
            <img v-if="item.cover_image_url" :src="apiUrl(item.cover_image_url)" alt="" />
            <div v-else :class="['news-cover-placeholder', `tone-${item.category}`]"><span>AX INSIGHT</span><strong>{{ categoryLabel(item.category) }}</strong><i></i></div>
          </div>
          <div class="news-card-body">
            <div class="news-meta"><span :class="['category-chip', item.category]">{{ categoryLabel(item.category) }}</span><span v-if="item.category === 'bp' && item.org_name" class="org-label"><Building2 :size="13" />{{ item.org_name }}</span></div>
            <h2>{{ item.title }}</h2>
            <div class="card-footer"><time>{{ formatDate(item.created_at) }}</time><span><Eye :size="15" />{{ formatCount(item.view_count) }}</span></div>
          </div>
        </button>
      </div>
      <div v-else class="content-state empty"><Newspaper :size="34" /><strong>등록된 뉴스가 없습니다.</strong><span>선택한 유형에 게시된 뉴스가 없습니다.</span></div>

      <BaseModal v-if="selectedNewsId" title="AI Tech News 상세" size="news" @close="closeNews">
        <div v-if="detailLoading" class="news-popup-empty"><LoaderCircle class="spin" :size="28" /><span>뉴스를 불러오는 중입니다.</span></div>
        <article v-else-if="selectedNews" class="news-popup">
          <header class="news-popup-head">
            <div class="news-popup-meta">
              <span :class="['news-popup-category', selectedNews.category]">{{ categoryLabel(selectedNews.category) }}</span>
              <span v-if="selectedNews.category === 'bp' && selectedNews.org_name" class="news-popup-org"><Building2 :size="13" />{{ selectedNews.org_name }}</span>
              <time>{{ formatDate(selectedNews.created_at) }}</time>
              <span class="news-popup-views"><Eye :size="14" />{{ formatCount(selectedNews.view_count) }}</span>
            </div>
            <h2>{{ selectedNews.title }}</h2>
          </header>
          <div v-if="selectedNews.cover_image_url" class="news-popup-cover"><img :src="apiUrl(selectedNews.cover_image_url)" alt="" /></div>
          <div v-if="selectedNews.category === 'external' && selectedNews.source_url" class="news-popup-source-row">
            <a class="news-popup-source" :href="selectedNews.source_url" target="_blank" rel="noreferrer"><span class="news-popup-source-icon"><ExternalLink :size="17" /></span><span class="news-popup-source-copy"><small>ORIGINAL SOURCE</small><b>외부 원문 기사 보기</b><em>{{ selectedNews.source_url }}</em></span></a>
          </div>
          <div class="news-popup-markdown" v-html="renderedMarkdown"></div>
        </article>
      </BaseModal>
    </div>
  </AppLayout>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { Building2, ExternalLink, Eye, LoaderCircle, Newspaper, Search } from "lucide-vue-next";
import AppLayout from "../layouts/AppLayout.vue";
import BaseModal from "../components/BaseModal.vue";
import { apiFetch, readApiError, resolveApiUrl } from "../api/client";

const tabs = [{ value: "all", label: "전체" }, { value: "wia", label: "위아 뉴스" }, { value: "external", label: "외부 뉴스" }, { value: "bp", label: "BP 사례" }];
const news = ref([]); const category = ref("all"); const query = ref(""); const loading = ref(true); const error = ref("");
const selectedNewsId = ref(""); const selectedNews = ref(null); const detailLoading = ref(false);
const categoryLabel = (value) => ({ wia: "위아 뉴스", external: "외부 뉴스", bp: "BP 사례" }[value] || "AI Tech News");
const categoryCount = (value) => value === "all" ? news.value.length : news.value.filter((item) => item.category === value).length;
const formatDate = (value) => String(value || "").slice(0, 10);
const formatCount = (value) => Number(value || 0).toLocaleString();
const apiUrl = (path) => resolveApiUrl(path);
const filteredNews = computed(() => { const keyword = query.value.trim().toLowerCase(); return news.value.filter((item) => (category.value === "all" || item.category === category.value) && (!keyword || item.title.toLowerCase().includes(keyword))); });
const renderedMarkdown = computed(() => DOMPurify.sanitize(marked.parse(selectedNews.value?.markdown || "")));
const loadNews = async () => { loading.value = true; error.value = ""; try { const response = await apiFetch("/api/news"); if (!response.ok) throw await readApiError(response, "뉴스 목록을 불러오지 못했습니다."); news.value = await response.json(); } catch (loadError) { error.value = loadError.message; } finally { loading.value = false; } };
const openNews = async (item) => { selectedNewsId.value = item.news_id; selectedNews.value = null; detailLoading.value = true; try { const response = await apiFetch(`/api/news/${item.news_id}?count_view=true`); if (!response.ok) throw await readApiError(response, "뉴스를 불러오지 못했습니다."); selectedNews.value = await response.json(); const index = news.value.findIndex((entry) => entry.news_id === item.news_id); if (index >= 0) news.value[index].view_count = selectedNews.value.view_count; } catch (loadError) { error.value = loadError.message; selectedNewsId.value = ""; } finally { detailLoading.value = false; } };
const closeNews = () => { selectedNewsId.value = ""; selectedNews.value = null; };
onMounted(loadNews);
</script>
