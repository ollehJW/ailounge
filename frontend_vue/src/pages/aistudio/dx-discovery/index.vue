<template>
  <div class="studio-page dx-page">
      <div class="dx-workspace">
        <aside class="dx-sessions">
          <button class="dx-new" :disabled="loading||simulationRunning" @click="createSession"><Plus :size="16" />새 채팅</button>
          <header><span>채팅 이력</span><b>{{ sessions.length }}</b></header>
          <div class="dx-session-list">
            <div v-if="loading" class="dx-session-empty">이력을 불러오는 중입니다.</div>
            <button v-for="session in sessions" :key="session.session_id" :class="{active:session.session_id===activeId}" :disabled="simulationRunning" @click="openSession(session.session_id)"><strong>{{ session.title }}</strong><small><Clock3 :size="11" />{{ date(session.updated_at) }}<em :class="session.status==='과제 발굴 완료'?'done':'progress'">{{ session.status }}</em></small><span title="이력 삭제" @click.stop="removeSession(session.session_id)"><Trash2 :size="14" /></span></button>
            <div v-if="!loading&&!sessions.length" class="dx-session-empty">저장된 채팅 이력이 없습니다.</div>
          </div>
        </aside>

        <section class="dx-chat-panel">
          <header><span></span><div><strong>DX 과제 발굴 Agent</strong><small>업무를 설명하면 필요한 정보를 차례로 확인합니다.</small></div><button class="dx-simulation" type="button" :disabled="simulationRunning" @click="runSimulation"><Sparkles :size="15" />{{ simulationRunning?"Simulation 진행 중":"Simulation" }}</button></header>
          <div ref="chatBody" class="dx-chat-body">
            <div v-for="(message,index) in displayMessages" :key="`${message.role}-${index}`" :class="['dx-message',message.role]"><span><Bot v-if="message.role==='agent'" :size="17" /><UserRound v-else :size="16" /></span><p>{{ message.text }}</p></div>
            <div v-if="typing" class="dx-message agent"><span><Bot :size="17" /></span><div class="typing-dots"><i></i><i></i><i></i></div></div>
          </div>
          <p v-if="error" class="dx-error">{{ error }}</p>
          <form @submit.prevent="sendMessage">
            <textarea
              v-model="input"
              rows="1"
              :class="{ 'has-overflow': inputHasOverflow }"
              :disabled="typing||simulationRunning"
              placeholder="해결하고 싶은 업무 과제를 자유롭게 설명해 주세요."
              @input="syncInputOverflow"
              @keydown.enter.exact.prevent="sendMessage"
            ></textarea>
            <button class="primary-button" :disabled="typing||simulationRunning||!input.trim()" aria-label="전송"><Send :size="17" /></button>
          </form>
        </section>
      </div>

      <section v-if="detail?.status==='과제 발굴 완료'" class="dx-result">
        <div class="dx-result-toolbar"><div><span>DISCOVERY COMPLETE</span><strong>과제 정의서가 완성되었습니다</strong></div><button class="secondary-button" @click="downloadDefinition"><Download :size="16" />과제정의서 다운로드</button></div>
        <article class="task-sheet">
          <header><h2>{{ fields.project_title }}</h2><div><span>업무 영역</span><strong>{{ fields.business_area }}</strong></div></header>
          <section><b>SEC.01</b><div><h3>적용 업무</h3><p>{{ fields.target_work }}</p></div></section>
          <div class="task-grid"><section><b>SEC.02</b><div><h3>현재 업무 방식</h3><p>{{ fields.current_process }}</p></div></section><section><b>SEC.03</b><div><h3>Pain Points</h3><ul><li v-for="item in fields.pain_points" :key="item">{{ item }}</li></ul></div></section></div>
          <section><b>SEC.04</b><div><h3>문제 발생 규모</h3><p>{{ fields.problem_scale }}</p></div></section>
          <section><b>SEC.05</b><div><h3>해결 방향</h3><p>{{ fields.solution_direction }}</p></div></section>
          <section><b>SEC.06</b><div><h3>필요 데이터</h3><div class="required-data"><article v-for="item in fields.required_data" :key="item.data_name"><strong>{{ item.data_name }}</strong><p>{{ item.description }}</p></article></div></div></section>
          <section><b>SEC.07</b><div><h3>기대 정량 효과</h3><ul class="effect"><li v-for="item in fields.quantitative_effect" :key="item">{{ item }}</li></ul></div></section>
          <section><b>SEC.08</b><div><h3>기대 정성 효과</h3><div class="effect-cards"><p v-for="item in fields.qualitative_effect" :key="item">{{ item }}</p></div></div></section>
          <section><b>SEC.09</b><div><h3>수혜 대상</h3><div class="beneficiaries"><span v-for="item in fields.beneficiaries" :key="item">{{ item }}</span></div></div></section>
        </article>
        <div class="dx-recommendations"><section><header><Database :size="18" /><strong>추천 Data</strong></header><p v-if="!detail.recommended_data_ids?.length">추천 로직 연동 후 표시됩니다.</p><span v-for="id in detail.recommended_data_ids" :key="id">{{ id }}</span></section><section><header><Bot :size="18" /><strong>추천 AI 자산</strong></header><p v-if="!detail.recommended_asset_ids?.length">추천 로직 연동 후 표시됩니다.</p><span v-for="id in detail.recommended_asset_ids" :key="id">{{ id }}</span></section></div>
      </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { Bot, Clock3, Database, Download, Plus, Send, Sparkles, Trash2, UserRound } from "@/icons/lucide";
import { apiFetch, readApiError } from "@/api/client";
import { useAuthStore } from "@/stores/auth";
import { SIMULATION_FIELDS, SIMULATION_INTERVAL_MS, SIMULATION_MESSAGES, SIMULATION_SESSION_ID, SIMULATION_TITLE } from "@/demo/dxRecruitmentSimulation";

const auth=useAuthStore();
const initial={role:"agent",text:"어떤 업무가 가장 힘드신가요? 편하게 이야기해주시면, 대화를 통해 과제를 구체화하고 과제 정의서와 참고할 Data·AI 자산까지 정리해드릴게요."};
const PRESERVED_SESSION_TITLE="AI 기반 고객 CS 반복 문의 표준 답변 추천";
const sessions=ref([]),detail=ref(null),activeId=ref(""),input=ref(""),inputHasOverflow=ref(false),loading=ref(true),typing=ref(false),simulationRunning=ref(false),error=ref(""),chatBody=ref(null);
let simulationRun=0;
const displayMessages=computed(()=>[initial,...(detail.value?.messages||[]).map(item=>({role:item.role,text:item.content}))]);
const defaults={project_title:"",business_area:"",target_work:"",current_process:"",pain_points:[],problem_scale:"",solution_direction:"",required_data:[],quantitative_effect:[],qualitative_effect:[],beneficiaries:[]};
const fields=computed(()=>({...defaults,...(detail.value?.fields||{})})); const date=value=>String(value||"").slice(0,10);
async function request(path,options={},fallback){const response=await apiFetch(path,options);if(!response.ok)throw await readApiError(response,fallback);return response.status===204?null:response.json();}
async function loadSessions(){loading.value=true;error.value="";try{sessions.value=await request("/api/dx-discovery/sessions",{},"이력을 불러오지 못했습니다.");if(sessions.value.length)await openSession(sessions.value[0].session_id,false);else await createSession();}catch(e){error.value=e.message;}finally{loading.value=false;}}
async function createSession(){error.value="";try{const created=await request("/api/dx-discovery/sessions",{method:"POST",headers:{Authorization:`Bearer ${auth.token}`}},"새 채팅을 만들지 못했습니다.");sessions.value=[created,...sessions.value];detail.value=created;activeId.value=created.session_id;await scrollBottom();}catch(e){error.value=e.message;}}
async function openSession(id,showLoading=true){if(showLoading)loading.value=true;error.value="";try{detail.value=await request(`/api/dx-discovery/sessions/${id}`,{},"채팅을 불러오지 못했습니다.");activeId.value=id;await scrollBottom();}catch(e){error.value=e.message;}finally{if(showLoading)loading.value=false;}}
async function removeSession(id){try{await request(`/api/dx-discovery/sessions/${id}`,{method:"DELETE",headers:{Authorization:`Bearer ${auth.token}`}},"이력을 삭제하지 못했습니다.");sessions.value=sessions.value.filter(item=>item.session_id!==id);if(activeId.value===id){detail.value=null;activeId.value="";if(sessions.value.length)await openSession(sessions.value[0].session_id);else await createSession();}}catch(e){error.value=e.message;}}
function syncInputOverflow(event){const target=event.currentTarget;inputHasOverflow.value=target.scrollHeight>target.clientHeight+1;}
async function sendMessage(){const text=input.value.trim();if(!text||typing.value)return;if(!activeId.value)await createSession();input.value="";inputHasOverflow.value=false;typing.value=true;error.value="";const optimistic={message_id:`local-${Date.now()}`,role:"user",content:text};detail.value={...detail.value,messages:[...(detail.value?.messages||[]),optimistic]};await scrollBottom();try{const updated=await request(`/api/dx-discovery/sessions/${activeId.value}/chat`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${auth.token}`},body:JSON.stringify({messages:[{role:"user",text}]})},"Agent 응답을 불러오지 못했습니다.");detail.value=updated;sessions.value=[updated,...sessions.value.filter(item=>item.session_id!==updated.session_id)];}catch(e){error.value=e.message;}finally{typing.value=false;await scrollBottom();}}
async function scrollBottom(){await nextTick();if(chatBody.value)chatBody.value.scrollTop=chatBody.value.scrollHeight;}
const wait=milliseconds=>new Promise(resolve=>window.setTimeout(resolve,milliseconds));
async function runSimulation(){
  const run=++simulationRun,now=new Date().toISOString();
  const session={session_id:SIMULATION_SESSION_ID,title:SIMULATION_TITLE,status:"과제 발굴 진행중",created_at:now,updated_at:now};
  simulationRunning.value=true;typing.value=false;error.value="";input.value="";inputHasOverflow.value=false;
  sessions.value=[session,...sessions.value.filter(item=>item.title===PRESERVED_SESSION_TITLE)];
  activeId.value=SIMULATION_SESSION_ID;
  detail.value={...session,messages:[],fields:{},recommended_data_ids:[],recommended_asset_ids:[]};
  await scrollBottom();
  try{
    for(let index=0;index<SIMULATION_MESSAGES.length;index+=1){
      const message=SIMULATION_MESSAGES[index];
      typing.value=message.role==="agent";
      await wait(SIMULATION_INTERVAL_MS);
      if(run!==simulationRun)return;
      typing.value=false;
      detail.value={...detail.value,messages:[...detail.value.messages,{message_id:"simulation-"+index,role:message.role,content:message.content,seq:index+1}]};
      await scrollBottom();
    }
    const completed={...detail.value,status:"과제 발굴 완료",fields:SIMULATION_FIELDS,updated_at:new Date().toISOString()};
    detail.value=completed;
    sessions.value=sessions.value.map(item=>item.session_id===SIMULATION_SESSION_ID?{...item,status:completed.status,updated_at:completed.updated_at}:item);
    await nextTick();
    document.querySelector(".dx-result")?.scrollIntoView({behavior:"smooth",block:"start"});
  }finally{
    if(run===simulationRun){typing.value=false;simulationRunning.value=false;}
  }
}
const escapeHtml=value=>String(value||"").replace(/[&<>\"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char]));
function downloadDefinition(){const f=fields.value;const list=items=>(items||[]).map(item=>`<li>${escapeHtml(typeof item==="string"?item:JSON.stringify(item))}</li>`).join("");const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><title>${escapeHtml(f.project_title)}</title><style>body{font-family:sans-serif;color:#16233a;max-width:900px;margin:40px auto;line-height:1.7}h1{border-bottom:2px solid #16233a;padding-bottom:20px}section{padding:18px 0;border-bottom:1px solid #ddd}h2{font-size:18px}</style><h1>${escapeHtml(f.project_title)}</h1>${Object.entries({"업무 영역":f.business_area,"적용 업무":f.target_work,"현재 업무 방식":f.current_process,"문제 발생 규모":f.problem_scale,"해결 방향":f.solution_direction}).map(([k,v])=>`<section><h2>${k}</h2><p>${escapeHtml(v)}</p></section>`).join("")}<section><h2>Pain Points</h2><ul>${list(f.pain_points)}</ul></section><section><h2>기대 정량 효과</h2><ul>${list(f.quantitative_effect)}</ul></section><section><h2>기대 정성 효과</h2><ul>${list(f.qualitative_effect)}</ul></section></html>`;const url=URL.createObjectURL(new Blob([html],{type:"text/html;charset=utf-8"}));const link=document.createElement("a");link.href=url;link.download=`${f.project_title||"과제정의서"}.html`;link.click();URL.revokeObjectURL(url);}
onMounted(loadSessions);
onBeforeUnmount(()=>{simulationRun+=1;});
</script>

