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
  /* A ordem aqui é a ordem do trabalho, e é ela que monta a lista de
     etapas no painel. "color" continua existindo porque comissões
     antigas foram salvas com ele. */
  var STAGES  = {
    wait:  {pt:"na fila",     en:"queued"},
    sketch:{pt:"sketch",      en:"sketch"},
    line:  {pt:"lineart",     en:"lineart"},
    flat:  {pt:"cor chapada", en:"flat colour"},
    color: {pt:"pintando",    en:"colouring"},
    render:{pt:"render",      en:"rendering"},
    done:  {pt:"entregue",    en:"delivered"}
  };
  /* Duas famílias de etiqueta: o QUE é o trabalho e QUEM está desenhado.
     Uma arte costuma ter uma de cada — "full body" + "feral", por exemplo.
     grupo: "tipo" aparece na primeira linha de filtros, "quem" na segunda. */
  var TAGS = [
    {id:"all",     grupo:"tipo", pt:"Tudo",                en:"Everything"},

    {id:"icon",    grupo:"tipo", pt:"Headshot / ícone",    en:"Headshot / icon"},
    {id:"half",    grupo:"tipo", pt:"Half body",           en:"Half body"},
    {id:"full",    grupo:"tipo", pt:"Full body",           en:"Full body"},
    {id:"ref",     grupo:"tipo", pt:"Reference sheet",     en:"Reference sheet"},
    {id:"badge",   grupo:"tipo", pt:"Badge",               en:"Badge"},
    {id:"ych",     grupo:"tipo", pt:"YCH",                 en:"YCH"},
    {id:"animada", grupo:"tipo", pt:"Animada",             en:"Animated"},

    {id:"furry",   grupo:"quem", pt:"Furry",               en:"Furry"},
    {id:"feral",   grupo:"quem", pt:"Feral",               en:"Feral"},
    {id:"kemono",  grupo:"quem", pt:"Kemono",              en:"Kemono"},
    {id:"human",   grupo:"quem", pt:"Humano / kemonomimi", en:"Human / kemonomimi"},
    {id:"pokemon", grupo:"quem", pt:"Pokémon",             en:"Pokémon"},
    {id:"mlp",     grupo:"quem", pt:"MLP",                 en:"MLP"},
    {id:"chibi",   grupo:"quem", pt:"Chibi",               en:"Chibi"},
    {id:"casal",   grupo:"quem", pt:"Casal / dupla",       en:"Couple / duo"}
  ];

  function isLate(c){
    if(!c.deadline || c.stage === "done") return false;
    var t = new Date(c.deadline + "T00:00:00").getTime();
    return !isNaN(t) && t < new Date().setHours(0,0,0,0);
  }
  /* Totais separados por moeda: somar dólar com real daria um número que
     não existe. Cada moeda tem o próprio recebido e a receber. */
  function metrics(lista){
    var cs = lista || Studio.d.commissions || [];
    var m = {active:0, late:0,
             BRL:{earned:0, due:0, n:0},
             USD:{earned:0, due:0, n:0}};
    cs.forEach(function(c){
      var v = +c.value || 0;
      var moeda = c.cur === "USD" ? "USD" : "BRL";
      if(c.stage !== "done") m.active++;
      if(isLate(c)) m.late++;
      if(!v) return;
      m[moeda].n++;
      if(c.paid === "full") m[moeda].earned += v;
      else if(c.paid === "half"){ m[moeda].earned += v/2; m[moeda].due += v/2; }
      else m[moeda].due += v;
    });
    ["BRL","USD"].forEach(function(k){
      m[k].earned = Math.round(m[k].earned);
      m[k].due    = Math.round(m[k].due);
    });
    return m;
  }
  /* a fila que vai ao ar: posição, tipo e etapa, nunca o cliente */
  function publicQueue(){
    return Studio.d.commissions
      .filter(function(c){ return c.stage !== "done"; })
      .map(function(c){ return {label:c.label||"", type:c.type||"", stage:c.stage||"wait"}; });
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

  /* Etiquetas antigas foram digitadas à mão e variavam na escrita
     ("half body", "halfbody"), o que as deixava fora de qualquer filtro.
     Converte para o identificador certo ao ler, venha de onde vier. */
  var TAG_ANTIGA = {
    "full body":"full", "fullbody":"full",
    "half body":"half", "halfbody":"half",
    "reference sheet":"ref", "referencesheet":"ref", "ref sheet":"ref",
    "headshot":"icon", "icone":"icon", "ícone":"icon", "animated":"animada"
  };
  function normalizeTags(list){
    return (list || [])
      .map(function(t){ var k = String(t).trim().toLowerCase(); return TAG_ANTIGA[k] || k; })
      .filter(function(t, i, a){ return t && a.indexOf(t) === i; });
  }

  /* lê o bloco de estado de um documento (o próprio, ou um index.html baixado) */
  function readState(doc){
    try{
      var el = (doc || document).querySelector("#app-state");
      return el ? withCleanTags(JSON.parse(el.textContent)) : null;
    }catch(e){ return null; }
  }
  /* aplica a conversão de etiquetas em qualquer conteúdo que entre */
  function withCleanTags(s){
    if(s && s.gallery) s.gallery.forEach(function(g){ g.tags = normalizeTags(g.tags); });
    return s;
  }

  return {
    $:$, $$:$$, Studio:Studio, STAGES:STAGES, TAGS:TAGS,
    PAIDLBL:PAIDLBL, BGLBL:BGLBL,
    metrics:metrics, isLate:isLate, publicQueue:publicQueue,
    hashPwd:hashPwd, PASS_KEY:PASS_KEY, DEFAULT_HASH:DEFAULT_HASH,
    clone:clone, readState:readState,
    normalizeTags:normalizeTags, withCleanTags:withCleanTags
  };
})();
