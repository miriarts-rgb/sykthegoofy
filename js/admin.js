/* ============================================================
   admin.js — painel da artista (página admin.html)

   Tudo vem do banco (Supabase) e volta para ele: conteúdo do site,
   pedidos e ateliê. Não há mais arquivo para baixar nem publicar, e o
   painel funciona igual no computador, no celular ou em qualquer lugar
   com internet.

   Quem pode o quê é decidido pelo servidor, não por este código. Sem
   sessão válida o banco não devolve pedido nem comissão — mexer no
   JavaScript daqui não muda isso.
   ============================================================ */
(function(){
  "use strict";
  var C = window.SykCore;
  var $ = C.$, $$ = C.$$, STAGES = C.STAGES;
  var DB = window.SykDB;

  var state = null, draft = null, needsFirstSave = false;
  var galAntigas = false;   /* galeria do painel: recentes primeiro por padrao */
  function S(){ return draft || state || {}; }
  function startDraft(){ if(!draft) draft = C.clone(state || {}); }
  function markDirty(){ $("#adm-state").textContent = "alterações não salvas"; }
  function showErr(e){ $("#adm-state").textContent = "erro: " + ((e && e.message) || e); }
  function pick(o,a,b){ return o[a] || o[b] || ""; }   /* painel roda em PT */

  /* ---------- login ----------
     Agora é o Supabase quem valida: email e senha conferidos no servidor.
     A senha antiga do site foi removida — ela era só um portão visual, e
     quem abrisse o código passava por ela. Aqui, sem sessão válida o banco
     simplesmente não devolve pedido nem comissão, independente do que o
     navegador tente. */
  function showPanel(){
    $("#gate").hidden = true;
    $("#adm-wrap").hidden = false;
    $("#admin-logout").hidden = false;
    $("#adm-save").textContent = "Salvar no site";
    DB.currentUser().then(function(u){
      $("#adm-who").textContent = u ? u.email : "";
    });
    var hint = $("#adm-mode");
    if(hint) hint.textContent = "Salvar grava no banco: o site mostra na hora, para todo mundo.";
    if(needsFirstSave){
      $("#adm-state").textContent = "primeira vez: confira e clique em Salvar no site";
      var w = $("#adm-offline");
      w.hidden = false;
      w.innerHTML = "<b>Faltava conteúdo no banco.</b> Completei com o que o site já mostra " +
        "(preços, artes e textos), mantendo o que você já tinha salvo. " +
        "Confira e clique em <b>Salvar no site</b> uma vez — a partir daí o painel comanda o site.";
    }
    renderAdmin();
  }
  $("#login-form").addEventListener("submit", function(e){
    e.preventDefault();
    var err = $("#login-err"), btn = $("#login-go");
    err.hidden = true; btn.disabled = true; btn.textContent = "entrando…";
    DB.signIn($("#login-email").value.trim(), $("#login-pass").value)
      .then(function(){ return loadAll(); })
      .then(function(){ showPanel(); })
      .catch(function(ex){
        var m = (ex && ex.message) || "";
        err.textContent = /invalid login/i.test(m)
          ? "Email ou senha não conferem."
          : /email not confirmed/i.test(m)
            ? "Esta conta ainda não foi confirmada. Marque “Auto Confirm User” no Supabase."
            : "Não consegui entrar: " + m;
        err.hidden = false;
        $("#login-pass").select();
      })
      .then(function(){ btn.disabled = false; btn.textContent = "Entrar"; });
  });
  $("#admin-logout").addEventListener("click", function(){
    DB.signOut().then(function(){ location.reload(); });
  });

  /* ---------- carregar tudo do banco ----------
     Some a antiga dependência de ler o index.html: não há mais arquivo
     para baixar nem trocar, e o painel funciona igual aberto por
     localhost, pelo site publicado ou pelo celular. */
  var orders = [], commissions = [];

  /* Banco vazio (primeira vez) não pode significar painel vazio: sem nada
     para ver, não haveria como salvar e sair do zero. Nesse caso o painel
     pega o conteúdo de reserva que vem dentro do index.html e já abre com
     ele pronto para gravar. */
  function seedFromSite(){
    return fetch("index.html", {cache:"no-store"})
      .then(function(r){ return r.text(); })
      .then(function(txt){
        var doc = new DOMParser().parseFromString(txt, "text/html");
        return C.readState(doc) || {};
      })
      .catch(function(){ return {}; });
  }

  /* "vazio" não é só {}: um salvamento feito antes desta tela existir pode
     ter gravado só um pedaço (o YCH, por exemplo). Se faltar o essencial,
     completa com o conteúdo do site SEM pisar no que já foi editado. */
  function isIncomplete(s){
    return !s || !s.prices || !s.prices.length;
  }

  function loadAll(){
    return Promise.all([DB.loadContent(), DB.listOrders(), DB.listCommissions()])
      .then(function(r){
        orders = r[1] || [];
        commissions = r[2] || [];
        var fromDb = r[0] || {};
        if(!isIncomplete(fromDb)){ state = fromDb; return; }
        return seedFromSite().then(function(seed){
          state = fromDb;
          if(!Object.keys(seed).length) return;
          /* semente como base, banco por cima: o que você já salvou vence */
          var merged = C.clone(seed);
          Object.keys(fromDb).forEach(function(k){ merged[k] = fromDb[k]; });
          draft = merged;
          needsFirstSave = true;
        });
      });
  }

  function boot(){
    if(!DB.ready){
      $("#gate").hidden = true;
      var w = $("#adm-offline");
      w.hidden = false;
      w.innerHTML = "<b>Banco não configurado.</b> Preencha <code>js/config.js</code> com a " +
        "Project URL e a chave publishable do Supabase.";
      return;
    }
    DB.currentUser()
      .then(function(user){
        if(!user) throw new Error("sem sessão");
        return loadAll().then(showPanel);
      })
      .catch(function(){
        $("#gate").hidden = false;
        $("#login-email").focus();
      });
  }

  /* ---------- salvar ----------
     Publicar direto no site só existe DENTRO do artifact da Claude, porque é
     o runtime dela que escreve a nova versão. Rodando em localhost esse
     runtime não existe — então o botão troca de função: gera o index.html já
     atualizado para você baixar e trocar na pasta. O trabalho nunca fica preso. */
  $("#adm-save").addEventListener("click", function(){
    if(!draft){ $("#adm-state").textContent = "nada para salvar"; return; }
    var btn = this;
    btn.disabled = true;
    $("#adm-state").textContent = "salvando…";
    draft.updated = new Date().toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"numeric"});
    DB.saveContent(draft)
      .then(function(){
        state = draft; draft = null;
        needsFirstSave = false;
        $("#adm-offline").hidden = true;
        $("#adm-state").textContent = "salvo ✓ o site já mostra";
        renderAdmin();
      })
      .catch(function(err){
        $("#adm-state").textContent = "não deu: " + (err && err.message ? err.message : "erro");
      })
      .then(function(){ btn.disabled = false; });
  });
  $("#adm-revert").addEventListener("click", function(){
    /* na primeira vez o rascunho É o conteúdo do site: descartar aqui
       deixaria o painel vazio sem ter salvo nada */
    if(needsFirstSave){
      $("#adm-state").textContent = "salve uma vez antes de descartar";
      return;
    }
    draft = null; $("#adm-state").textContent = ""; renderAdmin();
  });

  /* ---------- abas ---------- */
  $$("#adm-tabs button").forEach(function(b){
    b.addEventListener("click", function(){
      var t = b.getAttribute("data-tab");
      $$("#adm-tabs button").forEach(function(x){ x.setAttribute("aria-selected", String(x === b)); });
      $$(".adm-pane").forEach(function(p){ p.hidden = p.getAttribute("data-pane") !== t; });
    });
  });

  /* ---------- pedidos ---------- */
  var orderFilter = "novo";
  function typeName(id){
    var p = (S().prices||[]).filter(function(x){ return x.id === id; })[0];
    return p ? (p.pt || p.en) : "Comissão";
  }
  function renderOrders(){
    var all = orders || [];
    var novos = all.filter(function(o){ return o.status === "novo"; }).length;
    var badge = $("#tab-badge");
    badge.hidden = !novos;
    badge.textContent = novos ? "(" + novos + ")" : "";

    $("#orders-note").innerHTML = "<b>Pedidos chegam aqui automaticamente.</b> Quem preenche o " +
      "formulário do site cai nesta lista, de qualquer computador ou celular. " +
      "Aceitar um pedido cria a comissão no ateliê já com valor e prazo.";

    $$("#orders-filter [data-of]").forEach(function(b){
      b.setAttribute("aria-pressed", String(b.getAttribute("data-of") === orderFilter));
    });

    var box = $("#orders-list"); box.innerHTML = "";
    var list = all.filter(function(o){ return o.status === orderFilter; })
                  ;
    if(!list.length){
      box.innerHTML = '<p class="mini">Nenhum pedido ' +
        ({novo:"novo", aceito:"aceito", recusado:"recusado"}[orderFilter]) + ' por aqui.</p>';
      return;
    }
    list.forEach(function(o){
      var card = document.createElement("div");
      card.className = "kan-card";
      var when = new Date(o.created_at).toLocaleDateString("pt-BR",{day:"2-digit",month:"short"});
      var det = [typeName(o.type), o.finish === "flat" ? "flat" : "rendered",
                 o.chars > 1 ? o.chars + " personagens" : "1 personagem",
                 C.BGLBL[o.bg] || "", o.rating === "nsfw" ? "NSFW" : "SFW"].filter(Boolean).join(" · ");
      card.innerHTML =
        '<div style="min-width:0">' +
          '<div class="top"><span class="who"></span><span class="pill wait"></span>' +
            (o.estimate ? '<span class="pill paid-half"></span>' : '') + '</div>' +
          '<div class="what" style="font-size:.86rem; color:var(--cocoa-soft)"></div>' +
          '<div style="font-size:.85rem; margin-top:8px; white-space:pre-wrap"></div>' +
          '<div class="mini" style="margin-top:8px"></div>' +
          '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px" class="acts"></div>' +
        '</div>' +
        '<button class="iconbtn" type="button" title="apagar">✕</button>';
      card.querySelector(".who").textContent = o.who;
      card.querySelector(".pill.wait").textContent = when + " · " + o.contact;
      if(o.estimate) card.querySelector(".pill.paid-half").textContent =
        (o.cur === "USD" ? "$" : "R$") + o.estimate;
      card.querySelector(".what").textContent = det;
      card.querySelectorAll("div")[3].textContent = o.descricao || "";
      card.querySelector(".mini").textContent =
        (o.refs ? "refs: " + o.refs : "sem referências") + (o.deadline ? " · precisa até " + o.deadline : "");

      var acts = card.querySelector(".acts");
      function act(label, fn){
        var b = document.createElement("button");
        b.type = "button"; b.className = "chipbtn"; b.textContent = label;
        b.addEventListener("click", fn); acts.appendChild(b);
      }
      if(o.status === "novo"){
        /* aceitar: marca o pedido e cria a comissão, os dois no banco */
        act("aceitar", function(){
          DB.setOrderStatus(o.id, "aceito")
            .then(function(){
              return DB.addCommission({
                who:o.who, type:o.type, stage:"wait", paid:"no",
                value:o.estimate != null ? o.estimate : null,
                cur:o.cur === "USD" ? "USD" : "BRL",
                deadline:o.deadline || null
              });
            })
            .then(function(c){
              o.status = "aceito";
              commissions.push(c);
              renderOrders(); renderStudio();
            })
            .catch(showErr);
        });
        act("recusar", function(){ DB.setOrderStatus(o.id,"recusado").then(function(){ o.status="recusado"; renderOrders(); }).catch(showErr); });
      } else {
        act("voltar pra novos", function(){ DB.setOrderStatus(o.id,"novo").then(function(){ o.status="novo"; renderOrders(); }).catch(showErr); });
      }
      act("copiar pedido", function(){
        if(navigator.clipboard) navigator.clipboard.writeText(o.message || "");
      });
      card.querySelector(".iconbtn").addEventListener("click", function(){
        DB.deleteOrder(o.id).then(function(){
          orders = orders.filter(function(x){ return x.id !== o.id; });
          renderOrders();
        }).catch(showErr);
      });
      box.appendChild(card);
    });
  }
  $$("#orders-filter [data-of]").forEach(function(b){
    b.addEventListener("click", function(){ orderFilter = b.getAttribute("data-of"); renderOrders(); });
  });

  /* ---------- ateliê ---------- */
  /* a fila do site sai direto da tabela de comissões, então não há mais
     nada a sincronizar: mudar a etapa aqui já muda o site */
  function saveField(c, patch){
    Object.keys(patch).forEach(function(k){ c[k] = patch[k]; });
    DB.updateCommission(c.id, patch).catch(showErr);
  }
  /* digitar dispara muitos eventos: espera a pessoa parar antes de gravar */
  function debounced(c, key){
    var t = null;
    return function(value){
      c[key] = value;
      clearTimeout(t);
      t = setTimeout(function(){
        var patch = {}; patch[key] = value;
        DB.updateCommission(c.id, patch).catch(showErr);
      }, 600);
    };
  }
  function renderStudio(){
    var m = C.metrics(commissions), kb = $("#adm-kpis");
    var html = '<div class="kpi"><b>' + m.active + '</b><span>em andamento</span></div>';
    /* uma dupla de cartões por moeda, e só das moedas em uso: quem
       nunca cobrou em dólar não precisa ver dois zeros a mais */
    [["BRL","R$"],["USD","$"]].forEach(function(par){
      var d = m[par[0]];
      if(!d.n && par[0] === "USD") return;
      html += '<div class="kpi"><b>' + par[1] + d.earned + '</b><span>já recebido</span></div>' +
              '<div class="kpi"><b>' + par[1] + d.due + '</b><span>a receber</span></div>';
    });
    html += (m.late ? '<div class="kpi alert"><b>' + m.late + '</b><span>atrasada(s)</span></div>'
                    : '<div class="kpi"><b>0</b><span>atrasadas</span></div>');
    kb.innerHTML = html;

    var box = $("#adm-kan"); box.innerHTML = "";
    var cs = commissions;
    /* a mesma contagem que o site faz: só o que não foi entregue ocupa
       lugar. Aqui a posição vem acompanhada do nome — no site, não. */
    var pos = 0, posDe = {};
    cs.forEach(function(c){ if(c.stage !== "done") posDe[c.id] = ++pos; });
    if(!cs.length){
      box.innerHTML = '<p class="mini">Nenhuma comissão registrada. Clique em “nova comissão” quando fechar um trabalho.</p>';
      return;
    }
    cs.forEach(function(c, i){
      /* etapa desconhecida (registro antigo, ou digitada direto no banco)
         não pode derrubar o painel inteiro */
      var et = STAGES[c.stage] ? c.stage : "wait";
      var card = document.createElement("div");
      card.className = "kan-card" + (C.isLate(c) ? " late" : "");
      card.innerHTML =
        '<div style="min-width:0">' +
          '<div class="top">' +
            (posDe[c.id] ? '<span class="fila-pos">' + posDe[c.id] + 'º na fila</span>' : '') +
            '<span class="who"></span>' +
            '<span class="pill ' + et + '"></span>' +
            '<span class="pill paid-' + (c.paid||"no") + '"></span>' +
            (C.isLate(c) ? '<span class="late-flag">atrasada</span>' : '') +
          '</div>' +
          '<label class="pub-field">' +
            '<span>o site mostra</span>' +
            '<input type="text" class="pub-input" placeholder="Comissão ' + (posDe[c.id] ? String(posDe[c.id]).padStart(2,"0") : "01") + '" ' +
              'aria-label="Nome que aparece na fila do site">' +
          '</label>' +
          '<div class="kan-grid">' +
            '<input type="text" placeholder="@cliente" aria-label="Cliente">' +
            '<select aria-label="Tipo"></select>' +
            '<select aria-label="Etapa"></select>' +
            '<select aria-label="Pagamento"><option value="no">não pago</option><option value="half">50% pago</option>' +
              '<option value="full">pago</option></select>' +
            '<select aria-label="Moeda"><option value="BRL">R$ real</option><option value="USD">$ dólar</option></select>' +
            '<input type="number" placeholder="valor" aria-label="Valor">' +
            '<input type="date" aria-label="Prazo">' +
          '</div>' +
        '</div>' +
        '<button class="iconbtn" type="button" title="remover">✕</button>';

      card.querySelector(".who").textContent = c.who || "sem nome";
      card.querySelector(".pill." + et).textContent = STAGES[et].pt;
      card.querySelector(".pill.paid-" + (c.paid||"no")).textContent = C.PAIDLBL[c.paid||"no"];

      var ins = card.querySelectorAll(".kan-grid input"), sels = card.querySelectorAll("select");
      var pubIn = card.querySelector(".pub-input");
      /* etapas montadas a partir da lista única: acrescentar uma em
         core.js basta para ela aparecer aqui */
      Object.keys(STAGES).forEach(function(k){
        var o = document.createElement("option");
        o.value = k; o.textContent = STAGES[k].pt;
        sels[1].appendChild(o);
      });
      var typeSel = sels[0], moedaSel = sels[3];
      (S().prices||[]).forEach(function(p){
        var o = document.createElement("option"); o.value = p.id; o.textContent = p.pt; typeSel.appendChild(o);
      });
      /* o YCH também é comissão: sem ele aqui, uma vaga do mês não tinha
         como ser registrada com o tipo certo */
      var y = S().ych || {};
      if(y.active || c.type === "ych"){
        var oy = document.createElement("option");
        oy.value = "ych";
        oy.textContent = y.name_pt || y.name_en || "YCH do mês";
        typeSel.appendChild(oy);
      }
      pubIn.value = c.label || "";
      ins[0].value = c.who || ""; typeSel.value = c.type || "";
      sels[1].value = et; sels[2].value = c.paid || "no";
      moedaSel.value = c.cur || "BRL";
      ins[1].value = c.value != null ? c.value : ""; ins[2].value = c.deadline || "";
      ins[1].placeholder = "valor " + (moedaSel.value === "USD" ? "$" : "R$");

      var setWho = debounced(c, "who"), setValue = debounced(c, "value");
      var setLabel = debounced(c, "label");
      pubIn.addEventListener("input", function(){ setLabel(pubIn.value.trim() || null); });
      ins[0].addEventListener("input", function(){ setWho(ins[0].value); });
      ins[1].addEventListener("input", function(){
        setValue(ins[1].value === "" ? null : +ins[1].value);
      });
      typeSel.addEventListener("change", function(){
        /* escolher YCH já traz o preço do mês, que é fechado em dólar */
        var patch = {type:typeSel.value};
        var ych = S().ych || {};
        if(typeSel.value === "ych" && ych.priceUsd != null && c.value == null){
          patch.value = ych.priceUsd;
          patch.cur = "USD";
        }
        saveField(c, patch); renderStudio();
      });
      sels[1].addEventListener("change", function(){ saveField(c, {stage:sels[1].value}); renderStudio(); });
      sels[2].addEventListener("change", function(){ saveField(c, {paid:sels[2].value}); renderStudio(); });
      moedaSel.addEventListener("change", function(){ saveField(c, {cur:moedaSel.value}); renderStudio(); });
      ins[2].addEventListener("change", function(){
        saveField(c, {deadline:ins[2].value || null}); renderStudio();
      });
      card.querySelector(".iconbtn").addEventListener("click", function(){
        DB.deleteCommission(c.id).then(function(){
          commissions.splice(i,1); renderStudio();
        }).catch(showErr);
      });
      box.appendChild(card);
    });
  }
  $("#adm-kan-add").addEventListener("click", function(){
    var first = (S().prices||[])[0];
    DB.addCommission({who:"", type:first?first.id:"", stage:"wait", paid:"no",
                      value:null, cur:"BRL", deadline:null})
      .then(function(c){ commissions.push(c); renderStudio(); })
      .catch(showErr);
  });

  /* ---------- conteúdo do site ---------- */
  function renderAdmin(){
    renderOrders(); renderStudio();
    var s = S();

    $("#adm-open-toggle").textContent = s.open ? "✓ Abertas" : "✕ Fechadas";
    $("#adm-slots").value = s.slotsTotal || 5;

    var pb = $("#adm-prices"); pb.innerHTML = "";
    (s.prices||[]).forEach(function(p, i){
      var row = document.createElement("div"); row.className = "adm-row";
      row.innerHTML = '<input type="text" aria-label="Nome">' +
        '<input type="number" placeholder="R$ rend." style="width:96px" aria-label="Rendered BRL">' +
        '<input type="number" placeholder="R$ flat" style="width:96px" aria-label="Flat BRL">' +
        '<input type="number" placeholder="$ rend." style="width:88px" aria-label="Rendered USD">';
      var ins = row.querySelectorAll("input");
      ins[0].value = p.pt;
      ins[1].value = p.rendered.brl != null ? p.rendered.brl : "";
      ins[2].value = p.flat.brl != null ? p.flat.brl : "";
      ins[3].value = p.rendered.usd != null ? p.rendered.usd : "";
      ins[0].addEventListener("input", function(){ startDraft(); draft.prices[i].pt = ins[0].value; markDirty(); });
      ins[1].addEventListener("input", function(){ startDraft(); draft.prices[i].rendered.brl = ins[1].value===""?null:+ins[1].value; markDirty(); });
      ins[2].addEventListener("input", function(){ startDraft(); draft.prices[i].flat.brl = ins[2].value===""?null:+ins[2].value; markDirty(); });
      ins[3].addEventListener("input", function(){ startDraft(); draft.prices[i].rendered.usd = ins[3].value===""?null:+ins[3].value; markDirty(); });
      pb.appendChild(row);
    });

    var xb = $("#adm-extras"); xb.innerHTML = "";
    [["character","Personagem extra (cada)"],["bgSimple","Fundo simples"],
     ["bgDetailed","Fundo detalhado"],["nsfw","NSFW"]].forEach(function(pair){
      var row = document.createElement("div"); row.className = "adm-row";
      row.style.gridTemplateColumns = "1fr 90px";
      row.innerHTML = '<span style="font-size:.9rem"></span><input type="number" min="0" max="300" aria-label="Percentual">';
      row.querySelector("span").textContent = pair[1];
      var inp = row.querySelector("input");
      inp.value = (s.extras||{})[pair[0]] != null ? s.extras[pair[0]] : "";
      inp.addEventListener("input", function(){
        startDraft(); draft.extras = draft.extras || {};
        draft.extras[pair[0]] = inp.value === "" ? 0 : +inp.value;
        markDirty();
      });
      xb.appendChild(row);
    });

    var y = s.ych || {};
    $("#adm-ych-toggle").textContent = y.active ? "✓ Ligado" : "✕ Desligado";
    var yf = $("#adm-ych-fields"); yf.innerHTML = "";
    [["name_pt","Nome (PT)","text"],["name_en","Nome (EN)","text"],
     ["desc_pt","Descrição (PT)","text"],["desc_en","Descrição (EN)","text"],
     ["priceUsd","Preço US$","number"],
     ["slots","Vagas","number"],["taken","Ocupadas","number"]].forEach(function(f){
      var row = document.createElement("div"); row.className = "adm-row";
      row.style.gridTemplateColumns = "130px 1fr";
      row.innerHTML = '<span style="font-size:.9rem"></span><input type="' + f[2] + '" aria-label="' + f[1] + '">';
      row.querySelector("span").textContent = f[1];
      var inp = row.querySelector("input");
      inp.value = y[f[0]] != null ? y[f[0]] : "";
      inp.addEventListener("input", function(){
        startDraft(); draft.ych = draft.ych || {};
        draft.ych[f[0]] = f[2]==="number" ? (inp.value===""?null:+inp.value) : inp.value;
        markDirty();
      });
      yf.appendChild(row);
    });
    var yrow = document.createElement("div");
    yrow.style.cssText = "margin-top:10px; display:flex; gap:10px; flex-wrap:wrap; align-items:center";
    yrow.innerHTML = '<label class="chipbtn" style="text-transform:none; letter-spacing:0">' +
      'arte da base<input type="file" accept="image/*,video/mp4,video/webm" hidden></label>' +
      '<button class="chipbtn" type="button" id="adm-ych-anim"></button>';
    yrow.querySelector("input").addEventListener("change", function(){
      var f = this.files && this.files[0]; if(!f) return;
      enviarYch(f);
      this.value = "";
    });
    yf.appendChild(yrow);
    var animBtn = yrow.querySelector("#adm-ych-anim");
    animBtn.textContent = y.animated ? "✓ animado" : "✕ estático";
    animBtn.addEventListener("click", function(){
      startDraft(); draft.ych = draft.ych || {};
      draft.ych.animated = !draft.ych.animated; markDirty(); renderAdmin();
    });

    var gb = $("#adm-gallery"); gb.innerHTML = "";
    var botaoOrdem = $("#gal-sort");
    if(botaoOrdem) botaoOrdem.textContent = galAntigas ? "mais antigas primeiro" : "mais recentes primeiro";
    /* a lista guarda a mais nova na frente; aqui só muda o que se vê,
       o índice real continua sendo o da lista */
    var lista = (s.gallery||[]).map(function(g, i){ return {g:g, i:i}; });
    if(galAntigas) lista.reverse();
    lista.forEach(function(par){
      var g = par.g, i = par.i;
      var row = document.createElement("div"); row.className = "adm-row";
      row.style.gridTemplateColumns = "54px 1fr auto";
      row.innerHTML = '<div class="tag-pick"></div>' +
        '<button class="iconbtn" type="button" title="remover">✕</button>';
      var thumb = document.createElement(g.video ? "video" : "img");
      thumb.src = g.src;
      if(g.video){ thumb.muted = true; thumb.loop = true; thumb.autoplay = true; thumb.playsInline = true;
                   thumb.controls = false; thumb.disablePictureInPicture = true;
                   thumb.setAttribute("disablepictureinpicture", ""); }
      else { thumb.alt = ""; }
      thumb.style.cssText = "width:54px;height:54px;object-fit:cover;border:2px solid var(--line);border-radius:9px";
      row.insertBefore(thumb, row.firstChild);

      /* etiquetas por clique, não digitadas: digitar "ferral" criava um
         filtro que nunca aparece e a arte ficava fora de tudo */
      var pick = row.querySelector(".tag-pick");
      C.TAGS.filter(function(t){ return t.id !== "all"; }).forEach(function(t){
        var b = document.createElement("button");
        b.type = "button";
        b.className = "tag-chip";
        b.textContent = t.pt;
        var on = (g.tags||[]).indexOf(t.id) > -1;
        b.setAttribute("aria-pressed", String(on));
        b.addEventListener("click", function(){
          startDraft();
          var tags = draft.gallery[i].tags || [];
          var at = tags.indexOf(t.id);
          if(at > -1) tags.splice(at, 1); else tags.push(t.id);
          draft.gallery[i].tags = tags;
          b.setAttribute("aria-pressed", String(at === -1));
          markDirty();
        });
        pick.appendChild(b);
      });
      row.querySelector(".iconbtn").addEventListener("click", function(){
        startDraft();
        var removed = draft.gallery.splice(i,1)[0];
        /* tira o arquivo junto, senão fica ocupando espaço para sempre.
           As 16 artes antigas moram no repositório e não têm path: essas
           só saem da lista. */
        if(removed && removed.path) DB.deleteArt(removed.path);
        markDirty(); renderAdmin();
      });
      gb.appendChild(row);
    });
    var g = s.gallery || [];
    var embedded = g.filter(function(x){ return /^data:/.test(x.src||""); });
    var el = $("#adm-gal-size");
    el.textContent = g.length + " arte(s)" +
      (embedded.length ? " · " + embedded.length + " ainda embutida(s): reenvie para aliviar a página" : "");
    el.style.color = embedded.length ? "var(--warn)" : "";

    $("#adm-tos").value = (s.tos || []).join("\n");
    $("#adm-yes").value = (s.drawYes || []).join("\n");
    $("#adm-no").value  = (s.drawNo  || []).join("\n");
  }

  $("#adm-open-toggle").addEventListener("click", function(){
    startDraft(); draft.open = !draft.open; markDirty(); renderAdmin();
  });
  $("#adm-slots").addEventListener("input", function(){
    startDraft(); draft.slotsTotal = Math.max(1, +this.value || 1); markDirty();
  });
  $("#adm-ych-toggle").addEventListener("click", function(){
    startDraft(); draft.ych = draft.ych || {}; draft.ych.active = !draft.ych.active;
    markDirty(); renderAdmin();
  });
  /* Imagem crua de arte costuma ter vários MB, e aqui ela vira texto dentro
     do index.html — subir 10 PNGs desses inflou a página para 69 MB uma vez.
     Então a imagem é reduzida no próprio navegador antes de ser guardada:
     no máximo 1400px no maior lado, JPEG 82%. Vídeo não dá para reduzir
     assim, então passa direto e o painel avisa se estiver grande. */
  var MAX_PX = 1400, JPEG_Q = 0.82;

  /* Reduz no navegador e devolve um arquivo binário, não texto. Uma arte
     de 10 MB sai daqui com algumas centenas de KB, e vai para o
     armazenamento em vez de engordar o registro do banco. */
  function shrinkToBlob(file){
    return new Promise(function(resolve, reject){
      var fr = new FileReader();
      fr.onerror = reject;
      fr.onload = function(){
        var img = new Image();
        img.onerror = reject;
        img.onload = function(){
          var scale = Math.min(1, MAX_PX / Math.max(img.width, img.height));
          var w = Math.round(img.width * scale), h = Math.round(img.height * scale);
          var cv = document.createElement("canvas");
          cv.width = w; cv.height = h;
          var cx = cv.getContext("2d");
          cx.fillStyle = "#1E1410";      /* transparência vira o fundo do site */
          cx.fillRect(0, 0, w, h);
          cx.drawImage(img, 0, 0, w, h);
          cv.toBlob(function(blob){
            if(blob) resolve({blob:blob, ext:"jpg"});
            else reject(new Error("não consegui converter a imagem"));
          }, "image/jpeg", JPEG_Q);
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  /* ---------- colar, arrastar ou escolher ----------
     Uma área que aceita as três coisas. O Ctrl+V só é ouvido quando a
     aba correspondente está aberta, senão colar na galeria mandaria a
     imagem para o YCH sem querer. */
  function tiraArquivos(dt){
    var out = [];
    if(!dt) return out;
    if(dt.items){
      Array.prototype.forEach.call(dt.items, function(it){
        if(it.kind !== "file") return;
        var f = it.getAsFile();
        if(f && /^(image|video)\//.test(f.type)) out.push(f);
      });
    } else if(dt.files){
      Array.prototype.forEach.call(dt.files, function(f){
        if(/^(image|video)\//.test(f.type)) out.push(f);
      });
    }
    return out;
  }

  function ligarZona(zonaId, paneName, receber){
    var zona = $(zonaId); if(!zona) return;

    function ocupado(sim){ zona.classList[sim ? "add" : "remove"]("busy"); }
    function tratar(files){
      if(!files.length) return;
      ocupado(true);
      Promise.resolve(receber(files)).then(function(){ ocupado(false); });
    }

    zona.addEventListener("click", function(){ $("#adm-gal-file") && abrirEscolha(paneName); });
    zona.addEventListener("keydown", function(e){
      if(e.key === "Enter" || e.key === " "){ e.preventDefault(); abrirEscolha(paneName); }
    });
    ["dragenter","dragover"].forEach(function(ev){
      zona.addEventListener(ev, function(e){ e.preventDefault(); zona.classList.add("drag"); });
    });
    ["dragleave","drop"].forEach(function(ev){
      zona.addEventListener(ev, function(e){ e.preventDefault(); zona.classList.remove("drag"); });
    });
    zona.addEventListener("drop", function(e){ tratar(tiraArquivos(e.dataTransfer)); });

    /* colar vale para a aba que está aberta, venha o foco de onde vier */
    document.addEventListener("paste", function(e){
      var pane = document.querySelector('.adm-pane[data-pane="' + paneName + '"]');
      if(!pane || pane.hidden) return;
      var files = tiraArquivos(e.clipboardData);
      if(!files.length) return;
      e.preventDefault();
      tratar(files);
    });
  }

  function abrirEscolha(paneName){
    if(paneName === "galeria") $("#adm-gal-file").click();
    else {
      var inp = $("#adm-ych-fields") && $("#adm-ych-fields").querySelector('input[type="file"]');
      if(inp) inp.click();
    }
  }

  /* A arte do YCH também vai para o armazenamento. Antes virava texto
     dentro do registro do site — com uma imagem já era pesado; com um
     vídeo, inviável. */
  function enviarYch(file){
    var msg = $("#adm-ych-state");
    var isVid = /^video\//.test(file.type);
    if(msg) msg.textContent = "enviando…";
    var prep = isVid
      ? Promise.resolve({blob:file, ext:(file.name.split(".").pop() || "mp4").toLowerCase()})
      : shrinkToBlob(file);
    return prep
      .then(function(p){ return DB.uploadArt(p.blob, p.ext); })
      .then(function(up){
        startDraft();
        draft.ych = draft.ych || {};
        /* troca de arte: o arquivo antigo sai do armazenamento */
        var velho = draft.ych.path;
        draft.ych.image = up.url;
        draft.ych.path  = up.path;
        draft.ych.video = isVid;
        if(isVid) draft.ych.animated = true;
        if(velho) DB.deleteArt(velho);
        markDirty(); renderAdmin();
        if(msg) msg.textContent = isVid ? "vídeo no ar ✓" : "imagem no ar ✓";
      })
      .catch(function(e){
        if(msg) msg.textContent = "não subiu: " + ((e && e.message) || "erro");
      });
  }

  /* envio da galeria, usado pelo botão, pelo arrastar e pelo colar */
  function enviarGaleria(files){
    if(!files.length) return Promise.resolve();
    startDraft();
    draft.gallery = draft.gallery || [];
    var msg = $("#adm-gal-size"), done = 0, failed = 0;
    msg.textContent = "enviando 0 de " + files.length + "…";

    /* um de cada vez: mais lento, porém o progresso é real e uma arte
       que falhe não derruba o envio das outras */
    return files.reduce(function(chain, file){
      return chain.then(function(){
        var isVideo = /^video\//.test(file.type);
        var prep = isVideo
          ? Promise.resolve({blob:file, ext:((file.name||"video.mp4").split(".").pop() || "mp4").toLowerCase()})
          : shrinkToBlob(file);
        return prep
          .then(function(p){ return DB.uploadArt(p.blob, p.ext); })
          .then(function(up){
            var entry = {src:up.url, path:up.path, alt:"", tags:[], em:Date.now()};
            if(isVideo) entry.video = true;
            /* entra no topo: a peça recém-enviada é a que você quer ver */
            draft.gallery.unshift(entry);
            done++;
          })
          .catch(function(){ failed++; })
          .then(function(){
            msg.textContent = "enviando " + (done + failed) + " de " + files.length + "…";
          });
      });
    }, Promise.resolve()).then(function(){
      markDirty(); renderAdmin();
      $("#adm-state").textContent = failed
        ? failed + " arquivo(s) não subiram"
        : done + " arte(s) no ar — marque as etiquetas e salve";
    });
  }
  $("#adm-gal-file").addEventListener("change", function(){
    enviarGaleria(Array.prototype.slice.call(this.files || []));
    this.value = "";
  });

  var bo = $("#gal-sort");
  if(bo) bo.addEventListener("click", function(){ galAntigas = !galAntigas; renderAdmin(); });

  ligarZona("#gal-paste", "galeria", enviarGaleria);
  ligarZona("#ych-paste", "ych", function(files){ return enviarYch(files[0]); });
  function bindText(sel, key){
    $(sel).addEventListener("input", function(){
      startDraft();
      draft[key] = this.value.split("\n").map(function(l){ return l.trim(); }).filter(Boolean);
      markDirty();
    });
  }
  bindText("#adm-tos","tos"); bindText("#adm-yes","drawYes"); bindText("#adm-no","drawNo");

  /* ---------- backup ---------- */
  $("#adm-export").addEventListener("click", function(){
    var s = S();
    var payload = JSON.stringify({
      version:1, exportedAt:new Date().toISOString(),
      site:{prices:s.prices, extras:s.extras, gallery:s.gallery, ych:s.ych,
            tos:s.tos, drawYes:s.drawYes, drawNo:s.drawNo,
            open:s.open, slotsTotal:s.slotsTotal},
      studio:{commissions:commissions, orders:orders}
    }, null, 2);
    var ta = $("#adm-backup-text"); ta.hidden = false; ta.value = payload;
    var done = function(){ $("#adm-backup-state").textContent = "copiado — cole num arquivo .json e guarde"; };
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(payload).then(done, done);
    else { ta.select(); done(); }
  });
  $("#adm-import").addEventListener("change", function(){
    var f = this.files && this.files[0]; if(!f) return;
    var fr = new FileReader();
    fr.onload = function(){
      try{
        var p = JSON.parse(fr.result);
        /* só o conteúdo do site volta pelo backup: pedidos e comissões
           vivem no banco e reimportá-los criaria duplicatas */
        if(p.site){
          startDraft();
          Object.keys(p.site).forEach(function(k){ if(p.site[k] !== undefined) draft[k] = p.site[k]; });
          markDirty();
          $("#adm-backup-state").textContent = "conteúdo importado — confira e clique em salvar";
        } else {
          $("#adm-backup-state").textContent = "esse arquivo não tem conteúdo de site";
        }
        renderAdmin();
      }catch(e){
        $("#adm-backup-state").textContent = "não consegui ler esse arquivo: " + e.message;
      }
    };
    fr.readAsText(f); this.value = "";
  });

  boot();
})();
