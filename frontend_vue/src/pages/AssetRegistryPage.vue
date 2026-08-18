<template>
  <AppLayout>
    <div class="studio-page registry-page">
      <section class="registry-guide asset-reg-guide" aria-label="자산 등록 절차"><div class="asset-reg-guide-label">자산 등록 절차</div><div class="asset-reg-guide-steps"><template v-for="(item,index) in steps" :key="item.title"><div class="asset-reg-guide-step"><div class="asset-reg-guide-num">{{ index+1 }}</div><div><b>{{ item.title }}</b><span>{{ item.description }}</span></div></div><div v-if="index<steps.length-1" class="asset-reg-guide-arrow" aria-hidden="true">→</div></template></div></section>

      <section class="registry-history"><header><div><span>MY ASSETS</span><h2>나의 AI 자산 등록 기록</h2><p>제출한 자산의 심사 상태를 확인할 수 있습니다.</p></div><b>{{ myAssets.length }}건</b></header><div v-if="historyLoading" class="content-state"><LoaderCircle class="spin" />등록 기록을 불러오는 중입니다.</div><div v-else-if="myAssets.length" class="registry-history-list"><article v-for="asset in myAssets" :key="asset.asset_id"><span><Bot :size="18" /></span><div><strong>{{ asset.asset_name }}</strong><small>{{ asset.business_area }} · {{ asset.maturity_level }}</small></div><time>{{ date(asset.created_at) }}</time><nav><button @click="viewDocument(asset)"><Eye :size="13" />View</button><button v-if="['approved','rejected'].includes(asset.approval_status)" @click="feedback=asset"><MessageSquareText :size="13" />심사평</button></nav><em :class="asset.approval_status">{{ statusLabel(asset.approval_status) }}</em></article></div><div v-else class="content-state empty"><ShieldCheck :size="28" /><strong>아직 제출한 AI 자산이 없습니다.</strong><span>등록을 완료하면 심사 상태가 여기에 표시됩니다.</span></div></section>

      <nav v-if="!submitted" class="registry-stepper"><template v-for="(item,index) in steps" :key="item.title"><button :class="{active:step===index,done:maxStep>index}" :disabled="index>maxStep" @click="step=index"><span>{{ maxStep>index?'✓':index+1 }}</span><strong>{{ item.title }}</strong></button><i v-if="index<3"></i></template></nav>

      <section v-if="submitted" class="registry-complete"><span><CheckCircle2 :size="30" /></span><h2>제출이 완료되었습니다</h2><p>AI 자산 등록 요청이 접수되었습니다. 거버넌스 검토 결과는 이메일로 안내됩니다.</p><button class="primary-button" @click="reset">새 자산 등록</button></section>

      <form v-else-if="step===0" class="registry-card" @submit.prevent="stageSpec">
        <header><span>STEP 1 / 4</span><h2>자산 명세서 작성</h2><p>자산을 이해하고 재사용하는 데 필요한 핵심 정보를 작성합니다.</p></header>
        <div class="registry-body">
          <RegistrySection title="담당자 정보" :complete="sectionComplete.owner"><div class="registry-grid"><label><span>이름 *</span><input v-model="form.owner_name" placeholder="예: 홍길동" /></label><label><span>직급 *</span><input v-model="form.owner_job_title" placeholder="예: 책임매니저" /></label><label><span>조직명 *</span><input v-model="form.owner_org" placeholder="예: DX추진랩" /></label><label><span>이메일 *</span><input v-model="form.owner_email" type="email" placeholder="예: gildong@hyundai-wia.com" /></label></div></RegistrySection>
          <RegistrySection title="자산 기본 정보" :complete="sectionComplete.basic"><div class="registry-grid"><label class="full"><span>자산명 *</span><input v-model="form.asset_name" placeholder="자산의 기능과 목적이 드러나는 이름을 작성하세요." /></label><label class="full"><span>설명 *</span><textarea v-model="form.description" rows="3" placeholder="해결하는 문제와 핵심 기능을 2-3문장으로 설명하세요."></textarea></label><label><span>업무 영역 *</span><select v-model="form.business_area"><option value="">선택</option><option v-for="item in businessAreas" :key="item">{{ item }}</option></select></label><label><span>자산 성숙도 *</span><select v-model="form.maturity_level"><option value="">선택</option><option v-for="item in maturityLevels" :key="item">{{ item }}</option></select></label><ChipField class="full" label="Task 유형" :options="taskTypes" v-model="form.task_types" /><ChipField class="full" label="구현 방식" :options="implementationTypes" v-model="form.implementation_types" /><label class="full"><span>태그 * <small>Enter로 추가</small></span><input v-model="tagInput" @keydown.enter.prevent="addTag" @blur="addTag" placeholder="검색에 활용할 핵심 키워드를 입력하세요." /><div class="tag-list"><button v-for="tag in form.tags" :key="tag" type="button" @click="form.tags=form.tags.filter(item=>item!==tag)">#{{ tag }} <X :size="12" /></button></div></label></div></RegistrySection>
          <RegistrySection title="과제 정의" :complete="sectionComplete.definition"><div class="registry-grid"><GuideField class="full" label="문제 정의" v-model="form.problem_definition" guide="현재 업무의 반복 문제와 발생 원인을 구체적으로 작성하세요." /><GuideField class="full" label="As-Is Workflow" v-model="form.as_is_workflow" guide="현재 업무가 어떤 순서와 도구로 처리되는지 작성하세요." /><GuideField class="full" label="To-Be Workflow" v-model="form.to_be_workflow" guide="자산 적용 후 바뀌는 업무 흐름을 작성하세요." /><GuideField class="full" label="AI 개선 효과" v-model="form.ai_effect" guide="시간, 정확도, 표준화 등 기대 효과를 작성하세요." /></div></RegistrySection>
          <RegistrySection title="데이터 *" :complete="sectionComplete.data"><div class="data-switch"><label><input :checked="!form.has_data" type="checkbox" @change="form.has_data=!$event.target.checked" /> 데이터 없음 (해당 자산에 첨부할 데이터가 없습니다)</label></div><div v-if="form.has_data" class="registry-grid"><label class="full"><span>Data 유형 *</span><select v-model="form.data_type"><option value="">선택</option><option v-for="item in dataTypes" :key="item">{{ item }}</option></select></label><GuideField class="full" label="데이터 설명" v-model="form.data_description" guide="데이터의 출처, 주요 컬럼과 활용 범위를 작성하세요." /><div class="data-attachment-head full"><strong>데이터 첨부</strong><label><input v-model="form.has_train_validation_split" type="checkbox" @change="Object.assign(files,{sample:null,train:null,validation:null})" />학습 / 검증 구분</label></div><FilePicker v-if="!form.has_train_validation_split" class="full" label="샘플 데이터" :file="files.sample" @change="files.sample=$event" /><template v-else><FilePicker label="학습 샘플 데이터" :file="files.train" @change="files.train=$event" /><FilePicker label="검증 샘플 데이터" :file="files.validation" @change="files.validation=$event" /></template></div></RegistrySection>
          <RegistrySection title="적용 기술" :complete="sectionComplete.tech"><ItemEditor title="모델 / 알고리즘" :items="form.models" name-key="model_name" name-placeholder="모델명 (예: XGBoost)" @add="form.models.push(newTech())" @remove="form.models.splice($event,1)" /><ItemEditor title="기술 스택" :items="form.tech_stacks" name-key="stack_name" name-placeholder="라이브러리·프레임워크명 (예: PyTorch)" @add="form.tech_stacks.push(newTech())" @remove="form.tech_stacks.splice($event,1)" /></RegistrySection>
          <RegistrySection title="성능 지표" :complete="sectionComplete.metrics"><MetricEditor title="Before / After 비교" :items="form.before_after_metrics" type="comparison" @add="form.before_after_metrics.push(newComparison())" @remove="form.before_after_metrics.splice($event,1)" /><MetricEditor title="성능 지표" :items="form.performance_metrics" type="kpi" @add="form.performance_metrics.push(newKpi())" @remove="form.performance_metrics.splice($event,1)" /></RegistrySection>
          <RegistrySection title="자산 활용 화면 *" :complete="sectionComplete.slides"><p class="section-guide">실제 업무에서 어떻게 활용되는지 보여주는 이미지를 업로드하세요. 탐색 화면의 자산 활용 탭에 순서대로 표시됩니다.</p><div class="slide-list"><article v-for="(slide,index) in slides" :key="slide.id"><div class="slide-preview" @click="pickSlide(index)"><img v-if="slide.preview" :src="slide.preview" alt="" /><template v-else><ImagePlus :size="25" /><b>이미지 첨부</b><small>PNG · JPG · GIF · WEBP</small></template><span>{{ String(index+1).padStart(2,'0') }}</span></div><div><input v-model="slide.caption" placeholder="화면 제목" /><textarea v-model="slide.description" rows="2" placeholder="이 화면에서 확인할 수 있는 내용을 작성하세요."></textarea></div><div class="slide-actions"><button type="button" :disabled="index===0" @click="moveSlide(index,-1)">↑</button><button type="button" :disabled="index===slides.length-1" @click="moveSlide(index,1)">↓</button><button class="delete" type="button" :disabled="slides.length===1" @click="removeSlide(index)"><X :size="15" /></button></div></article><button type="button" class="add-slide" @click="slides.push(newSlide())"><Plus :size="18" />이미지 추가</button></div><input ref="slideInput" type="file" accept="image/*" hidden @change="setSlideFile" /></RegistrySection>
          <p v-if="error" class="form-error page-error">{{ error }}</p><div class="registry-actions"><span v-if="!specReady"><AlertCircle :size="15" />완료되지 않은 대분류를 확인하세요.</span><button class="primary-button" :disabled="!specReady||saving">{{ saving?'저장 중...':'다음' }}<ArrowRight :size="16" /></button></div>
        </div>
      </form>

      <section v-else-if="step===1" class="registry-card compact-step">
        <header><span>STEP 2 / 4</span><h2>자산 연동</h2><p>GitHub 또는 GitLab 저장소를 연결하면 코드 구조가 자산에 자동으로 연결됩니다.</p></header>
        <div class="registry-body asset-reg-repo-body">
          <div class="asset-reg-repo-panel">
            <div class="asset-reg-repo-grid">
              <input v-model="form.repo_url" aria-label="Git 저장소 URL" placeholder="저장소 URL (예: https://github.com/hyundai-wia/asset-name)" />
              <input v-model="form.repo_branch" aria-label="브랜치명" placeholder="브랜치명 (예: main)" />
              <button type="button" :disabled="cloning||!form.repo_url" @click="cloneRepo">{{ cloning?`연결 중...`:`연결` }}</button>
            </div>
            <p v-if="repoError" class="asset-reg-repo-inline-error"><AlertCircle :size="16" />{{ repoError }}</p>
            <div class="asset-reg-file-tree">
              <div class="asset-reg-file-tree-title">저장소 구조 <span>{{ form.repo_branch||`브랜치 미지정` }}</span></div>
              <p v-if="cloning" class="asset-reg-repo-loading"><LoaderCircle class="spin" :size="16" />Git 저장소를 가져오는 중입니다.</p>
              <RepoTree v-else-if="repoTree.length" :items="repoTree" />
              <p v-else>Git을 연결하면 이 영역에 폴더 구조가 표시됩니다.</p>
            </div>
          </div>
        </div>
        <footer class="asset-reg-nav"><button class="secondary-button" type="button" @click="step=0">이전</button><button class="primary-button" type="button" :disabled="!repoTree.length" :title="!repoTree.length?`Git 저장소를 연결한 후 이동할 수 있습니다.`:undefined" @click="advance(2)">다음</button></footer>
      </section>

      <section v-else-if="step===2" class="registry-card compact-step">
        <header><span>STEP 3 / 4</span><h2>확산 패키지 생성</h2><p>LLM이 연동된 저장소의 코드·README를 분석하여 Claude Skill 파일을 자동 생성합니다.</p></header>
        <div class="registry-body asset-reg-skill-body">
          <div class="asset-reg-skill-trigger" :class="{loading:planning||generating}">
            <div><Sparkles :size="18" /><b>LLM 기반 자동 생성</b><span>저장소 구조, README, 설정 파일을 분석해 Skill 정의 파일과 실행 보조 스크립트를 작성합니다.</span></div>
            <button v-if="!generatedFiles.length" class="primary-button asset-reg-skill-generate" type="button" :disabled="planning||generating" @click="planSkills"><LoaderCircle v-if="planning||generating" class="spin" :size="15" /><Sparkles v-else :size="15" />{{ planning||generating?`생성중...`:`Skill 자동 생성` }}</button>
          </div>
          <div v-if="planning||generating" class="asset-reg-skill-loading"><LoaderCircle class="spin" :size="18" /><div><b>Skill 파일을 생성하고 있습니다</b><p>저장소 구조, README, 설정 파일을 분석 중입니다. 잠시만 기다려주세요.</p></div></div>
          <div v-if="generatedFiles.length" class="asset-reg-skill-result">
            <section class="asset-reg-skill-section">
              <div class="asset-reg-skill-result-head"><FolderGit2 :size="18" /><b>생성된 Skill 파일 구조</b></div>
              <div class="asset-reg-skill-explorer">
                <div class="asset-reg-skill-tree-pane">
                  <div class="asset-reg-skill-tree-head"><span>생성된 파일</span><em>{{ generatedFiles.length }} files</em></div>
                  <SkillTree :files="generatedFiles" v-model="selectedFile" />
                </div>
                <div class="asset-reg-skill-viewer">
                  <div v-if="selectedFile">{{ selectedFile }}</div>
                  <pre v-if="selectedFile">{{ selectedFileContent }}</pre>
                  <p v-else>← 파일을 클릭하면 내용이 표시됩니다</p>
                </div>
              </div>
            </section>
          </div>
          <p v-if="skillError&&!skillModalOpen" class="form-error page-error">{{ skillError }}</p>
        </div>
        <footer class="asset-reg-nav"><button class="secondary-button" type="button" @click="step=1">이전</button><button class="primary-button" type="button" :disabled="!generatedFiles.length" :title="!generatedFiles.length?`확산 패키지 생성을 완료한 후 이동할 수 있습니다.`:undefined" @click="advance(3)">다음</button></footer>
      </section>

      <section v-else class="registry-card compact-step">
        <header><span>STEP 4 / 4</span><h2>최종 제출 및 승인</h2><p>아래 내용을 확인하고 동의하면 최종 제출이 가능합니다.</p></header>
        <div class="registry-body asset-reg-submit-body">
          <div class="asset-reg-submit-notice">
            <Clock3 :size="20" />
            <div><b>승인까지 약 7일이 소요됩니다</b><span>제출된 자산은 거버넌스 검토(보안·라이선스·품질 게이트)를 거친 후 AI Studio에 공개됩니다. 검토 결과는 등록 담당자 이메일로 안내됩니다.</span></div>
          </div>
          <div class="asset-reg-agree-list">
            <label v-for="(label,key) in agreementLabels" :key="key"><input v-model="agreements[key]" type="checkbox" /><span>{{ label }}</span></label>
          </div>
          <p v-if="error" class="asset-reg-submit-error">{{ error }}</p>
        </div>
        <footer class="asset-reg-nav"><button class="secondary-button" type="button" @click="step=2">이전</button><button class="primary-button" type="button" :disabled="!allAgreed||saving" @click="submitAsset">{{ saving?`제출 중...`:`제출` }}</button></footer>
      </section>

      <Teleport to="body">
        <div v-if="skillModalOpen" class="modal-backdrop asset-reg-skill-progress-backdrop" role="presentation">
          <article class="asset-reg-skill-progress-modal" role="dialog" aria-modal="true" aria-label="Skill 자동 생성 진행">
            <header class="asset-reg-skill-progress-head">
              <span><Sparkles :size="16" />확산 패키지 생성</span>
              <h2>{{ skillModalTitle }}</h2>
              <p>{{ skillModalDescription }}</p>
            </header>

            <div v-if="skillPhase===`planning`" class="asset-reg-plan-loading">
              <LoaderCircle class="spin" :size="24" />
              <div><b>Skill Generation Planning</b><p>후보군 추출, 확산 점수 계산, reference_files 선정 절차를 진행합니다.</p></div>
            </div>

            <template v-else-if="skillPhase===`selecting`">
              <div class="asset-reg-skill-plan-summary"><b>Planning 결과</b><p>{{ skillPlan?.asset_summary||`자산 요약 정보가 없습니다.` }}</p></div>
              <div class="asset-reg-skill-candidate-list">
                <button v-for="candidate in skillPlan?.candidates||[]" :key="candidate.slug" class="asset-reg-skill-candidate" :class="{selected:selectedSkills.includes(candidate.slug)}" type="button" @click="toggleSkillCandidate(candidate.slug)">
                  <span class="asset-reg-skill-check">{{ selectedSkills.includes(candidate.slug)?`✓`:`` }}</span>
                  <div>
                    <div class="asset-reg-skill-candidate-top"><strong>{{ candidate.title }}</strong><em>{{ candidate.slug }}</em><small v-if="candidate.recommended">Recommended</small></div>
                    <p>{{ candidate.reusable_pattern }}</p>
                    <div class="asset-reg-skill-score"><span>Diffusion Score</span><b>{{ candidate.diffusion_score }}</b></div>
                    <blockquote>{{ candidate.reason }}</blockquote>
                  </div>
                </button>
              </div>
              <footer class="asset-reg-skill-progress-actions"><button class="secondary-button" type="button" @click="cancelSkillGeneration">취소</button><button class="primary-button" type="button" :disabled="!selectedSkills.length" @click="generateSkills">선택 완료</button></footer>
            </template>

            <div v-else-if="skillPhase===`generating`" class="asset-reg-generation-steps">
              <div v-for="(item,index) in generationSteps" :key="item.id" class="asset-reg-generation-step" :class="{done:index<generationStepIndex,active:index===generationStepIndex}">
                <span>{{ index<generationStepIndex?`✓`:index+1 }}</span>
                <div><b>{{ item.label }}</b><p>{{ index<generationStepIndex?`생성 완료`:index===generationStepIndex?`AI가 파일을 분석하고 생성하고 있습니다. 작업에 다소 시간이 걸릴 수 있습니다.`:`대기 중` }}</p></div>
              </div>
            </div>

            <div v-else-if="skillPhase===`error`" class="asset-reg-skill-error"><b>생성 작업을 완료하지 못했습니다</b><p>{{ skillError }}</p><button class="primary-button" type="button" @click="closeSkillError">확인</button></div>
          </article>
        </div>
      </Teleport>

      <BaseModal v-if="documentHtml" title="AI 자산 등록서" size="large" @close="documentHtml='' "><iframe class="asset-document-frame" :srcdoc="documentHtml" title="AI 자산 등록서"></iframe></BaseModal>
      <BaseModal v-if="feedback" title="자산 심사평" size="small" @close="feedback=null"><div class="feedback-modal"><span :class="feedback.approval_status"><MessageSquareText :size="22" /></span><h2>심사평</h2><dl><div><dt>심사일</dt><dd>{{ date(feedback.reviewed_at) }}</dd></div><div><dt>심사평</dt><dd>{{ feedback.review_comment||'등록된 심사평이 없습니다.' }}</dd></div></dl><button class="primary-button" @click="feedback=null">확인</button></div></BaseModal>
    </div>
  </AppLayout>
</template>

<script setup>
import { computed,onBeforeUnmount,onMounted,reactive,ref } from "vue";import { AlertCircle,ArrowRight,Bot,Check,CheckCircle2,Clock3,Eye,FolderGit2,GitBranch,ImagePlus,LoaderCircle,MessageSquareText,Plus,Send,ShieldCheck,Sparkles,Wand2,X } from "lucide-vue-next";import AppLayout from "../layouts/AppLayout.vue";import BaseModal from "../components/BaseModal.vue";import RegistrySection from "../components/RegistrySection.vue";import ChipField from "../components/ChipField.vue";import GuideField from "../components/GuideField.vue";import FilePicker from "../components/FilePicker.vue";import ItemEditor from "../components/ItemEditor.vue";import MetricEditor from "../components/MetricEditor.vue";import RepoTree from "../components/RepoTree.vue";import SkillTree from "../components/SkillTree.vue";import { useAuthStore } from "../stores/auth";import { apiFetch,readApiError } from "../api/client";
const auth=useAuthStore();const steps=[{title:"자산 명세서 작성",description:"담당자 정보, 자산 개요, 과제 정의, 데이터, 기술·성능 지표를 작성합니다."},{title:"자산 연동",description:"GitHub/GitLab 저장소를 연결해 실제 코드·데이터 구조를 확인합니다."},{title:"확산 패키지 생성",description:"LLM이 저장소를 분석해 Claude Skill 파일을 자동 생성합니다."},{title:"최종 제출 및 승인",description:"필독 사항 동의 후 제출하면 거버넌스 검토를 거쳐 카탈로그에 공개됩니다."}];const businessAreas=["생산·제조","품질","R&D·설계","SCM·구매·물류","영업·마케팅","경영지원","안전·환경·보건","IT·DX","공통"],maturityLevels=["아이디어","PoC","Pilot","운영"],taskTypes=["예측","탐지","분류","검색","질의응답","요약","생성","추출","추천","분석","최적화","자동화"],implementationTypes=["ML","DL","Computer Vision","LLM","RAG","Agent","Rule-Based","Hybrid"],dataTypes=["테이블·정형데이터","시계열 데이터","센서·IoT 데이터","문서·텍스트","이미지","영상","음성","로그","CAD·도면","코드","웹·외부 데이터","복합 데이터"];
const createUuid=()=>{if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();const bytes=new Uint8Array(16);if(globalThis.crypto?.getRandomValues)globalThis.crypto.getRandomValues(bytes);else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const hex=Array.from(bytes,value=>value.toString(16).padStart(2,"0")).join("");return hex.substring(0,8)+"-"+hex.substring(8,12)+"-"+hex.substring(12,16)+"-"+hex.substring(16,20)+"-"+hex.substring(20);};
const newTech=()=>({model_name:"",stack_name:"",description:"",reference_url:""}),newComparison=()=>({metric_name:"",before_value:"",after_value:"",improvement_rate:""}),newKpi=()=>({metric_name:"",value:"",description:""}),newSlide=()=>({id:createUuid(),file:null,preview:"",caption:"",description:""});const initialForm=()=>({asset_id:createUuid(),owner_name:auth.user?.displayed_name||"",owner_job_title:auth.user?.job_title||"",owner_org:auth.user?.org_name||"",owner_email:auth.user?.email||"",asset_name:"",description:"",business_area:"",maturity_level:"",task_types:[],implementation_types:[],tags:[],problem_definition:"",as_is_workflow:"",to_be_workflow:"",ai_effect:"",has_data:true,has_train_validation_split:false,data_type:"",data_description:"",models:[newTech()],tech_stacks:[newTech()],before_after_metrics:[newComparison()],performance_metrics:[newKpi()],repo_url:"",repo_branch:"main"});
const form=reactive(initialForm()),files=reactive({sample:null,train:null,validation:null}),slides=ref([newSlide()]),tagInput=ref(""),step=ref(0),maxStep=ref(0),saving=ref(false),error=ref(""),repoTree=ref([]),cloning=ref(false),repoError=ref(""),skillPlan=ref(null),planning=ref(false),selectedSkills=ref([]),generating=ref(false),generationLabel=ref(""),generationStepIndex=ref(0),skillModalOpen=ref(false),skillPhase=ref("idle"),generatedFiles=ref([]),skillError=ref(""),selectedFile=ref(""),submitted=ref(false),myAssets=ref([]),historyLoading=ref(true),documentHtml=ref(""),feedback=ref(null),slideInput=ref(null),slideTarget=ref(0),agreements=reactive({share:false,factual:false,security:false});
const agreementLabels={share:"등록 자산의 사내 공유 및 재사용에 동의합니다.",factual:"등록 자산의 주요 정보가 실제 구현 내용과 사용 결과를 바탕으로 작성되었음을 확인합니다.",security:"등록 자산에 개인정보, 영업비밀, 외부 반출 제한 정보가 포함되지 않았음을 확인합니다."};
const filled=value=>String(value||"").trim().length>0,itemsComplete=(items,keys)=>items.length>0&&items.every(item=>keys.every(key=>filled(item[key])));const sectionComplete=computed(()=>({owner:[form.owner_name,form.owner_job_title,form.owner_org,form.owner_email].every(filled),basic:[form.asset_name,form.description,form.business_area,form.maturity_level].every(filled)&&form.task_types.length&&form.implementation_types.length&&form.tags.length,definition:[form.problem_definition,form.as_is_workflow,form.to_be_workflow,form.ai_effect].every(filled),data:!form.has_data||([form.data_type,form.data_description].every(filled)&&(form.has_train_validation_split?(files.train&&files.validation):files.sample)),tech:itemsComplete(form.models,["model_name","description"])&&itemsComplete(form.tech_stacks,["stack_name","description"]),metrics:itemsComplete(form.before_after_metrics,["metric_name","before_value","after_value","improvement_rate"])&&itemsComplete(form.performance_metrics,["metric_name","value","description"]),slides:slides.value.length>0&&slides.value.every(item=>item.file&&filled(item.caption)&&filled(item.description))}));const specReady=computed(()=>Object.values(sectionComplete.value).every(Boolean)),allAgreed=computed(()=>Object.values(agreements).every(Boolean)),selectedFileContent=computed(()=>generatedFiles.value.find(item=>item.path===selectedFile.value)?.content||""),generationSteps=computed(()=>[{id:"claude",label:"CLAUDE.md 생성"},...selectedSkills.value.map(slug=>{const candidate=skillPlan.value?.candidates?.find(item=>item.slug===slug);return{id:slug,label:(candidate?.title||slug)+" 생성"};})]),skillModalTitle=computed(()=>skillPhase.value==="selecting"?"Skill 후보를 선택하세요":skillPhase.value==="error"?"Skill 생성 실패":"Skill 자동 생성 진행중"),skillModalDescription=computed(()=>skillPhase.value==="planning"?"자산 명세서와 저장소 구조를 분석해 확산 가치가 높은 Skill 후보군을 추출하고 있습니다.":skillPhase.value==="selecting"?"생성할 Skill을 직접 선택할 수 있습니다. 추천 후보는 기본 선택되어 있습니다.":skillPhase.value==="error"?"아래 오류를 확인한 뒤 다시 시도하세요.":"선택된 Skill과 CLAUDE.md를 순차적으로 생성하고 있습니다.");
const addTag=()=>{const value=tagInput.value.trim().replace(/^#/,"");if(value&&!form.tags.includes(value))form.tags.push(value);tagInput.value="";};function pickSlide(index){slideTarget.value=index;slideInput.value?.click();}function setSlideFile(event){const file=event.target.files?.[0];if(!file)return;const slide=slides.value[slideTarget.value];if(slide.preview)URL.revokeObjectURL(slide.preview);slide.file=file;slide.preview=URL.createObjectURL(file);event.target.value="";}function removeSlide(index){if(slides.value[index].preview)URL.revokeObjectURL(slides.value[index].preview);slides.value.splice(index,1);}function moveSlide(index,offset){const target=index+offset;if(target<0||target>=slides.value.length)return;const [item]=slides.value.splice(index,1);slides.value.splice(target,0,item);}
function payload(){return {...form,slides:slides.value.map(item=>({caption:item.caption,description:item.description})),skill_files:generatedFiles.value};}function buildData(){const data=new FormData();data.append("payload_json",JSON.stringify(payload()));slides.value.forEach(item=>item.file&&data.append("slides",item.file));if(form.has_data){if(form.has_train_validation_split){if(files.train)data.append("train_files",files.train);if(files.validation)data.append("validation_files",files.validation);}else if(files.sample)data.append("sample_files",files.sample);}return data;}async function call(path,options={},fallback){const response=await apiFetch(path,options);if(!response.ok)throw await readApiError(response,fallback);return response.status===204?null:response.json();}
async function stageSpec(){if(!specReady.value)return;saving.value=true;error.value="";try{const result=await call("/api/assets/staging",{method:"POST",body:buildData()},"자산 명세서를 임시 저장하지 못했습니다.");form.asset_id=result.asset_id;advance(1);}catch(e){error.value=e.message;}finally{saving.value=false;}}const advance=value=>{maxStep.value=Math.max(maxStep.value,value);step.value=value;window.scrollTo({top:0,behavior:"smooth"});};
async function cloneRepo(){cloning.value=true;repoError.value="";try{const result=await call("/api/assets/repository/clone",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({asset_id:form.asset_id,repo_url:form.repo_url,repo_branch:form.repo_branch||null})},"저장소를 연결하지 못했습니다.");repoTree.value=result.tree||[];}catch(e){repoError.value=e.message;}finally{cloning.value=false;}}
async function planSkills(){
  if(planning.value||generating.value)return;
  planning.value=true;skillError.value="";skillPlan.value=null;generatedFiles.value=[];selectedFile.value="";selectedSkills.value=[];generationStepIndex.value=0;skillPhase.value="planning";skillModalOpen.value=true;
  try{
    const plan=await call("/api/assets/"+form.asset_id+"/skill-plan",{method:"POST"},"Skill 후보를 생성하지 못했습니다.");
    skillPlan.value=plan;
    selectedSkills.value=Array.isArray(plan.selected_skill_slugs)&&plan.selected_skill_slugs.length?plan.selected_skill_slugs:(plan.candidates||[]).filter(item=>item.recommended).map(item=>item.slug);
    skillPhase.value="selecting";
  }catch(e){skillError.value=e.message;skillPhase.value="error";}finally{planning.value=false;}
}
function toggleSkillCandidate(slug){if(skillPhase.value!=="selecting")return;selectedSkills.value=selectedSkills.value.includes(slug)?selectedSkills.value.filter(item=>item!==slug):[...selectedSkills.value,slug];}
function cancelSkillGeneration(){skillModalOpen.value=false;skillPhase.value="idle";skillError.value="";skillPlan.value=null;selectedSkills.value=[];planning.value=false;}
function closeSkillError(){skillModalOpen.value=false;skillPhase.value="idle";skillError.value="";planning.value=false;generating.value=false;}
async function generateSkills(){
  if(!selectedSkills.value.length||generating.value)return;
  generating.value=true;skillError.value="";generationStepIndex.value=0;skillPhase.value="generating";
  try{
    const response=await apiFetch("/api/assets/"+form.asset_id+"/skills/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({selected_skill_slugs:selectedSkills.value})});
    if(!response.ok)throw await readApiError(response,"Skill을 생성하지 못했습니다.");
    if(!response.body)throw new Error("Skill 생성 진행 상태를 수신할 수 없습니다.");
    const reader=response.body.getReader(),decoder=new TextDecoder(),stepsSnapshot=generationSteps.value;let buffer="",completedEvent=null;
    const processLine=line=>{if(!line.trim())return;const event=JSON.parse(line);if(event.type==="error")throw new Error(event.message||"Skill을 생성하지 못했습니다.");const index=stepsSnapshot.findIndex(item=>item.id===event.step_id);if(event.type==="step_started"&&index>=0){generationStepIndex.value=index;generationLabel.value=event.label||stepsSnapshot[index].label;}if(event.type==="step_completed"&&index>=0)generationStepIndex.value=index+1;if(event.type==="completed")completedEvent=event;};
    while(true){const result=await reader.read();buffer+=decoder.decode(result.value||new Uint8Array(),{stream:!result.done});const lines=buffer.split(String.fromCharCode(10));buffer=lines.pop()||"";for(const line of lines)processLine(line);if(result.done)break;}
    processLine(buffer);
    if(!completedEvent)throw new Error("Skill 생성 완료 결과를 수신하지 못했습니다.");
    generatedFiles.value=completedEvent.files||[];selectedFile.value=generatedFiles.value[0]?.path||"";generationStepIndex.value=stepsSnapshot.length;skillPhase.value="done";skillModalOpen.value=false;
  }catch(e){skillError.value=e.message;skillPhase.value="error";}finally{generating.value=false;}
}
async function submitAsset(){saving.value=true;error.value="";try{await call("/api/assets",{method:"POST",body:buildData()},"자산을 제출하지 못했습니다.");submitted.value=true;await loadMine();}catch(e){error.value=e.message;}finally{saving.value=false;}}async function loadMine(){historyLoading.value=true;try{myAssets.value=await call("/api/assets/mine",{},"등록 기록을 불러오지 못했습니다.");}catch(e){error.value=e.message;}finally{historyLoading.value=false;}}async function viewDocument(asset){try{const response=await apiFetch(`/api/assets/${asset.asset_id}/registration-document`);if(!response.ok)throw await readApiError(response,"등록서를 불러오지 못했습니다.");documentHtml.value=await response.text();}catch(e){error.value=e.message;}}
const statusLabel=value=>({submitted:"제출 완료",approved:"승인",rejected:"반려"}[value]||value),date=value=>String(value||"").slice(0,10);function reset(){slides.value.forEach(item=>item.preview&&URL.revokeObjectURL(item.preview));Object.assign(form,initialForm());Object.assign(files,{sample:null,train:null,validation:null});slides.value=[newSlide()];step.value=0;maxStep.value=0;repoTree.value=[];skillPlan.value=null;generatedFiles.value=[];selectedSkills.value=[];skillModalOpen.value=false;skillPhase.value="idle";generationStepIndex.value=0;planning.value=false;generating.value=false;Object.keys(agreements).forEach(key=>agreements[key]=false);submitted.value=false;}
onMounted(loadMine);onBeforeUnmount(()=>slides.value.forEach(item=>item.preview&&URL.revokeObjectURL(item.preview)));
</script>
