/* ============================================================
   core.js — o que index.html e admin.html usam em comum.
   Carregue SEMPRE antes de site.js ou admin.js.
   ============================================================ */
window.SykCore = (function(){
  "use strict";

  var $  = function(s,r){ return (r||document).querySelector(s); };
  var $$ = function(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };

  /* ---- ateliê: dados privados, só no navegador de quem usa o painel.
     Nome de cliente, valor, prazo e pagamento NUNCA entram no arquivo
     publicado. O site mostra apenas a fila anônima de publicQueue(). ---- */
  var LS = "syk-studio-v1";
  var Studio = {
    d:{commissions:[], orders:[]},
    load:function(){
      try{
        var r = localStorage.getItem(LS);
        if(r){ var p = JSON.parse(r); this.d = {commissions:p.commissions||[], orders:p.orders||[]}; }
      }catch(e){}
      return this.d;
    },
    save:function(){ try{ localStorage.setItem(LS, JSON.stringify(this.d)); return true; }catch(e){ return false; } },
    /* relê antes de gravar: o formulário pode ter criado um pedido noutra aba */
    addOrder:function(o){
      var fresh = {commissions:this.d.commissions, orders:this.d.orders.slice()};
      try{
        var r = localStorage.getItem(LS);
        if(r){
          var p = JSON.parse(r), known = {};
          this.d.orders.forEach(function(x){ known[x.id] = 1; });
          (p.orders||[]).forEach(function(x){ if(!known[x.id]) fresh.orders.push(x); });
        }
      }catch(e){}
      fresh.orders.push(o);
      this.d = fresh; this.save();
    }
  };

  var PAIDLBL = {no:"não pago", half:"50% pago", full:"pago"};
  var BGLBL   = {none:"sem fundo", simple:"fundo simples", detailed:"fundo detalhado"};
  var STAGES  = {
    wait:  {pt:"na fila",  en:"queued"},
    sketch:{pt:"sketch",   en:"sketch"},
    color: {pt:"pintando", en:"colouring"},
    done:  {pt:"entregue", en:"delivered"}
  };
  var TAGS = [
    {id:"all",    pt:"Tudo",               en:"Everything"},
    {id:"furry",  pt:"Furry",              en:"Furry"},
    {id:"feral",  pt:"Feral",              en:"Feral"},
    {id:"kemono", pt:"Kemono",             en:"Kemono"},
    {id:"pokemon",pt:"Pokémon",            en:"Pokémon"},
    {id:"human",  pt:"Humano / kemonomimi",en:"Human / kemonomimi"},
    {id:"mlp",    pt:"MLP",                en:"MLP"},
    {id:"icon",   pt:"Ícone",              en:"Icon"},
    {id:"full",   pt:"Full body",          en:"Full body"}
  ];

  function isLate(c){
    if(!c.deadline || c.stage === "done") return false;
    var t = new Date(c.deadline + "T00:00:00").getTime();
    return !isNaN(t) && t < new Date().setHours(0,0,0,0);
  }
  function metrics(){
    var m = {active:0, late:0, earned:0, due:0};
    Studio.d.commissions.forEach(function(c){
      var v = +c.value || 0;
      if(c.stage !== "done") m.active++;
      if(c.paid === "full") m.earned += v;
      else if(c.paid === "half"){ m.earned += v/2; m.due += v/2; }
      else m.due += v;
      if(isLate(c)) m.late++;
    });
    m.earned = Math.round(m.earned); m.due = Math.round(m.due);
    return m;
  }
  /* a fila que vai ao ar: posição, tipo e etapa, nunca o cliente */
  function publicQueue(){
    return Studio.d.commissions
      .filter(function(c){ return c.stage !== "done"; })
      .map(function(c){ return {type:c.type||"", stage:c.stage||"wait"}; });
  }

  /* senha do painel.
     AVISO: conferida no navegador, então NÃO é segurança de verdade — quem
     abre o código vê como funciona. Serve para manter curiosos longe do
     painel. Nada crítico depende dela: o ateliê já vive só nesta máquina e
     publicar exige permissão real da plataforma. */
  var PASS_KEY = "syk-adm";
  var DEFAULT_HASH = "1r3fp1m-6";          /* syk123 */
  function hashPwd(s){
    var h = 2166136261;
    for(var i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h,16777619); }
    return (h>>>0).toString(36) + "-" + s.length;
  }

  function clone(o){ return JSON.parse(JSON.stringify(o)); }

  /* lê o bloco de estado de um documento (o próprio, ou um index.html baixado) */
  function readState(doc){
    try{
      var el = (doc || document).querySelector("#app-state");
      return el ? JSON.parse(el.textContent) : null;
    }catch(e){ return null; }
  }

  return {
    $:$, $$:$$, Studio:Studio, STAGES:STAGES, TAGS:TAGS,
    PAIDLBL:PAIDLBL, BGLBL:BGLBL,
    metrics:metrics, isLate:isLate, publicQueue:publicQueue,
    hashPwd:hashPwd, PASS_KEY:PASS_KEY, DEFAULT_HASH:DEFAULT_HASH,
    clone:clone, readState:readState
  };
})();
