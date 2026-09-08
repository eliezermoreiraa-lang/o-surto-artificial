/* Shared public/member support catalogue and BRL input. No payment is created here. */
(() => {
  'use strict';
  const plans = [
    {tier:'free',label:'APOIO LIVRE',price:'VOCÊ ESCOLHE',amount:10,tag:'SEM LOGIN · CONTA OPCIONAL',text:'Apoio sem divulgação e sem aparição.',benefits:['Não precisa criar conta ou fazer login','Ajuda a pagar tokens, ferramentas e produções','Recebe todo o carinho da equipe do Surto']},
    {tier:'supporter',label:'APOIADOR',price:'R$ 50,00',amount:50,tag:'JUNTOS PELO SURTO',text:'Divulgação coletiva — não é participação como personagem.',benefits:['Bloco com até 6 apoiadores','Avatar e @ na tela','Área exclusiva do apoiador']},
    {tier:'highlight',label:'APOIADOR DESTAQUE',price:'R$ 100,00',amount:100,tag:'MAIS PRESENÇA NA TELA',text:'Divulgação com mais destaque — não é participação como personagem.',benefits:['Bloco com até 3 apoiadores','Maior presença visual','Prioridade na fila de divulgação']},
    {tier:'vip',label:'APOIADOR VIP',price:'R$ 300,00',amount:300,tag:'UMA CENA SÓ SUA',text:'Cena promocional individual — não é participação como personagem.',benefits:['Encerramento dedicado só a você','Briefing para cena personalizada','Prioridade máxima']}
  ].map(p=>Object.freeze({...p,seal:'/assets-min/seal-'+p.tier+'.svg',className:'club-plan club-plan-'+p.tier}));
  const format = amount => Number(amount).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const cents = value => Number(String(value).replace(/\D/g,'') || 0);
  function bindMoney(input,onChange=()=>{}) {
    if(!input||input.dataset.moneyBound)return;
    input.dataset.moneyBound='1';
    input.addEventListener('focus',()=>input.select());
    input.addEventListener('input',()=>{
      const digits=String(input.value).replace(/\D/g,'').slice(0,11);
      const amount=Number(digits||0)/100;
      input.value=format(amount);onChange(amount);
    });
  }
  const intentKey='surto-club-checkout';
  let pending=null;
  function remember(tier,amount=10,billingMode='one_time'){
    if(!plans.some(p=>p.tier===tier))return;
    pending={tier,amount:Number.isFinite(amount)&&amount>=1?amount:10,billingMode:billingMode==='monthly'&&tier!=='free'?'monthly':'one_time',at:Date.now()};
    try{sessionStorage.setItem(intentKey,JSON.stringify(pending))}catch(_){}
  }
  function consume(){
    let value=pending;pending=null;
    try{value=value||JSON.parse(sessionStorage.getItem(intentKey)||'null');sessionStorage.removeItem(intentKey)}catch(_){}
    return value&&plans.some(p=>p.tier===value.tier)&&Date.now()-value.at<3600000?value:null;
  }
  window.SurtoClub=Object.freeze({plans,format,parse:value=>cents(value)/100,bindMoney,remember,consume});
})();
