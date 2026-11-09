const form=document.getElementById("surveyForm"), box=document.getElementById("questionsContainer"), msg=document.getElementById("message"), btn=document.getElementById("submitBtn");
let questions=[];
async function loadQuestions(){
  try{
    const r=await fetch("/api/survey/questions"), data=await r.json();
    if(!r.ok) throw new Error(data.message);
    questions=data;
    box.innerHTML=questions.map((q,i)=>`<section class="question"><div class="qtitle"><span class="qnum">${i+1}</span>${safe(q.questionText)}</div><div class="options">${q.options.map(o=>`<label class="option"><input type="radio" name="q${i}" value="${safe(o)}" required><span>${safe(o)}</span></label>`).join("")}</div></section>`).join("");
    box.querySelectorAll("input").forEach(input=>input.addEventListener("change",updateProgress));
  }catch(e){box.textContent=e.message;btn.disabled=true;}
}
function updateProgress(){let n=questions.filter((_,i)=>form.querySelector(`[name="q${i}"]:checked`)).length;document.getElementById("progressText").textContent=`${n} of 5 answered`;document.getElementById("progressBar").style.width=`${n*20}%`;}
form.addEventListener("submit",async e=>{
  e.preventDefault();msg.textContent="";msg.className="";
  const respondentName=document.getElementById("respondentName").value.trim();
  const answers=questions.map((q,i)=>({questionId:q._id,answer:form.querySelector(`[name="q${i}"]:checked`)?.value||""}));
  if(!respondentName||answers.some(a=>!a.answer)){msg.textContent="Enter your name and answer all five questions.";return;}
  btn.disabled=true;btn.textContent="Submitting...";
  try{
    const r=await fetch("/api/survey/submit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({respondentName,answers})});
    const data=await r.json();if(!r.ok)throw new Error(data.message);
    msg.textContent=data.message;msg.className="success";form.reset();updateProgress();await loadQuestions();
  }catch(err){msg.textContent=err.message;}
  finally{btn.disabled=false;btn.textContent="Submit survey →";}
});
function safe(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
loadQuestions();