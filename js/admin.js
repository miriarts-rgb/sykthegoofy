/* ============================================================
   admin.js — painel da artista (página admin.html)

   Como a publicação funciona aqui:
   o conteúdo do site mora no bloco <script id="app-state"> DENTRO do
   index.html. Esta página não é o index, então ela BAIXA o index.html,
   troca aquele bloco pelo estado novo e publica o documento inteiro.
   Por isso admin.html precisa ser servido por http (no site publicado,
   ou local com um servidor). Abrindo por file:// o navegador bloqueia a
   leitura do index.html — aí o painel avisa e segue gerenciando só o
   ateliê, que vive no localStorage e não depende disso.
   ============================================================ */
(function(){
  "use strict";
  var C = window.SykCore;
  var $ = C.$, $$ = C.$$, Studio = C.Studio, STAGES = C.STAGES;

  var state = null, draft = null, indexHtml = null, canPublish = false;
  function S(){ return draft || state || {}; }
  function startDraft(){ if(!draft) draft = C.clone(state || {}); }
  function markDirty(){ $("#adm-state").textContent = "alterações não publicadas"; }
  function pick(o,a,b){ return o[a] || o[b] || ""; }   /* painel roda em PT */

  /* ---------- login ---------- */
  var platformEditor = false;
  function currentHash(){ return (S().admPass) || C.DEFAULT_HASH; }
  function isLogged(){
    if(platformEditor) return true;
    try{ return localStorage.getItem(C.PASS_KEY) === currentHash(); }catch(e){ return false; }
  }
  function showPanel(){
    $("#gate").hidden = true;
    $("#adm-wrap").hidden = false;
    $("#adm-who").textContent = platformEditor ? "editor da plataforma" : "senha";
    $("#admin-logout").hidden = false;
    /* o botão diz o que de fato vai acontecer neste modo */
    $("#adm-save").textContent = isHosted ? "Publicar alterações" : "Baixar index.html atualizado";
    var hint = $("#adm-mode");
    if(hint){
      hint.textContent = isHosted
        ? "Você está no site publicado: salvar aqui publica para todo mundo na hora."
        : "Você está rodando local: salvar gera o index.html novo para você trocar na pasta. "
        + "Publicar para todo mundo só acontece pelo site publicado.";
    }
    renderAdmin();
  }
  $("#login-form").addEventListener("submit", function(e){
    e.preventDefault();
    if(C.hashPwd($("#login-pass").value) !== currentHash()){
      $("#login-err").hidden = false;
      $("#login-pass").select();
      return;
    }
    try{ localStorage.setItem(C.PASS_KEY, currentHash()); }catch(err){}
    showPanel();
  });
  $("#admin-logout").addEventListener("click", function(){
    try{ localStorage.removeItem(C.PASS_KEY); }catch(e){}
    location.reload();
  });

  /* ---------- carregar o estado do site ---------- */
  function boot(){
    Studio.load();
    fetch("index.html", {cache:"no-store"})
      .then(function(r){ if(!r.ok) throw new Error(r.status); return r.text(); })
      .then(function(txt){
        indexHtml = txt;
        var doc = new DOMParser().parseFromString(txt, "text/html");
        state = C.readState(doc) || {};
        canPublish = true;
      })
      .catch(function(){
        /* sem acesso ao index: só o ateliê funciona */
        state = {};
        canPublish = false;
        var w = $("#adm-offline");
        w.hidden = false;
        w.innerHTML = "<b>O painel abriu pela metade.</b> Pedidos e comissões funcionam; " +
          "preços, galeria, YCH, textos e o botão de publicar estão desligados.<br><br>" +
          "<b>Por quê:</b> aberto por <code>file://</code> (dois cliques no arquivo), o navegador " +
          "proíbe esta página de ler o <code>index.html</code> — e é de lá que vem o conteúdo do site.<br><br>" +
          "<b>Como resolver:</b> feche esta aba, dê dois cliques em <b>servidor.cmd</b> na pasta do site " +
          "e abra <b>http://localhost:8080/admin.html</b>. Ou use o painel pelo site publicado.";
      })
      .then(function(){
        if(isLogged()) showPanel();
        else $("#login-pass").focus();
      });
  }

  /* ---------- salvar ----------
     Publicar direto no site só existe DENTRO do artifact da Claude, porque é
     o runtime dela que escreve a nova versão. Rodando em localhost esse
     runtime não existe — então o botão troca de função: gera o index.html já
     atualizado para você baixar e trocar na pasta. O trabalho nunca fica preso. */
  var isHosted = !!(window.claude && window.claude.use);

  function buildNextIndex(){
    draft.updated = new Date().toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"numeric"});
    draft.queue = C.publicQueue();
    var next = indexHtml.replace(
      /(<script id="app-state" type="application\/json">)[\s\S]*?(<\/script>)/,
      function(_, a, b){ return a + JSON.stringify(draft).replace(/<\//g,"<\\/") + b; }
    );
    return next === indexHtml ? null : next;
  }

  $("#adm-save").addEventListener("click", function(){
    if(!canPublish){ $("#adm-state").textContent = "salvar indisponível aqui"; return; }
    if(!draft){ $("#adm-state").textContent = "nada para salvar"; return; }
    var btn = this;
    var next = buildNextIndex();
    if(!next){ $("#adm-state").textContent = "não achei o bloco de estado no index"; return; }

    if(!isHosted){
      /* modo local: entrega o arquivo pronto */
      try{
        var blob = new Blob([next], {type:"text/html"});
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "index.html";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function(){ URL.revokeObjectURL(a.href); }, 4000);
        indexHtml = next; state = draft; draft = null;
        $("#adm-state").textContent = "index.html baixado — troque o da pasta";
        renderAdmin();
      }catch(e){
        $("#adm-state").textContent = "não consegui gerar o arquivo: " + e.message;
      }
      return;
    }

    btn.disabled = true;
    $("#adm-state").textContent = "publicando…";
    Promise.resolve(window.claude.use("artifact"))
      .then(function(artifact){
        if(!artifact) throw new Error("esta conta não tem permissão de edição neste site");
        return artifact.publish(next);
      })
      .then(function(){
        indexHtml = next; state = draft; draft = null;
        $("#adm-state").textContent = "publicado ✓";
        renderAdmin();
      })
      .catch(function(err){
        $("#adm-state").textContent = "não deu: " + (err && err.message ? err.message : "erro");
      })
      .then(function(){ btn.disabled = false; });
  });
  $("#adm-revert").addEventListener("click", function(){
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
    var all = Studio.d.orders || [];
    var novos = all.filter(function(o){ return o.status === "novo"; }).length;
    var badge = $("#tab-badge");
    badge.hidden = !novos;
    badge.textContent = novos ? "(" + novos + ")" : "";

    $("#orders-note").innerHTML = "<b>Como os pedidos chegam aqui.</b> O formulário do site grava o pedido " +
      "no navegador de quem preencheu. Você vê os que forem feitos <b>neste mesmo navegador</b>. " +
      "O que sempre chega é a mensagem que o cliente copia e manda no Telegram ou Discord.";

    $$("#orders-filter [data-of]").forEach(function(b){
      b.setAttribute("aria-pressed", String(b.getAttribute("data-of") === orderFilter));
    });

    var box = $("#orders-list"); box.innerHTML = "";
    var list = all.filter(function(o){ return o.status === orderFilter; })
                  .sort(function(a,b){ return b.at - a.at; });
    if(!list.length){
      box.innerHTML = '<p class="mini">Nenhum pedido ' +
        ({novo:"novo", aceito:"aceito", recusado:"recusado"}[orderFilter]) + ' por aqui.</p>';
      return;
    }
    list.forEach(function(o){
      var card = document.createElement("div");
      card.className = "kan-card";
      var when = new Date(o.at).toLocaleDateString("pt-BR",{day:"2-digit",month:"short"});
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
      card.querySelectorAll("div")[3].textContent = o.desc || "";
      card.querySelector(".mini").textContent =
        (o.refs ? "refs: " + o.refs : "sem referências") + (o.deadline ? " · precisa até " + o.deadline : "");

      var acts = card.querySelector(".acts");
      function act(label, fn){
        var b = document.createElement("button");
        b.type = "button"; b.className = "chipbtn"; b.textContent = label;
        b.addEventListener("click", fn); acts.appendChild(b);
      }
      if(o.status === "novo"){
        act("aceitar", function(){
          o.status = "aceito";
          Studio.d.commissions.push({id:"c"+Date.now().toString(36), who:o.who, type:o.type,
            stage:"wait", paid:"no", value:o.estimate != null ? o.estimate : null, deadline:o.deadline || ""});
          Studio.save(); renderOrders(); renderStudio(); touchQueue();
        });
        act("recusar", function(){ o.status = "recusado"; Studio.save(); renderOrders(); });
      } else {
        act("voltar pra novos", function(){ o.status = "novo"; Studio.save(); renderOrders(); });
      }
      act("copiar pedido", function(){
        if(navigator.clipboard) navigator.clipboard.writeText(o.message || "");
      });
      card.querySelector(".iconbtn").addEventListener("click", function(){
        Studio.d.orders = Studio.d.orders.filter(function(x){ return x.id !== o.id; });
        Studio.save(); renderOrders();
      });
      box.appendChild(card);
    });
  }
  $$("#orders-filter [data-of]").forEach(function(b){
    b.addEventListener("click", function(){ orderFilter = b.getAttribute("data-of"); renderOrders(); });
  });

  /* ---------- ateliê ---------- */
  function touchQueue(){
    if(!canPublish) return;
    startDraft(); draft.queue = C.publicQueue(); markDirty();
  }
  function renderStudio(){
    var m = C.metrics(), kb = $("#adm-kpis");
    kb.innerHTML =
      '<div class="kpi"><b>' + m.active + '</b><span>em andamento</span></div>' +
      '<div class="kpi"><b>R$' + m.earned + '</b><span>já recebido</span></div>' +
      '<div class="kpi"><b>R$' + m.due + '</b><span>a receber</span></div>' +
      (m.late ? '<div class="kpi alert"><b>' + m.late + '</b><span>atrasada(s)</span></div>'
              : '<div class="kpi"><b>0</b><span>atrasadas</span></div>');

    var box = $("#adm-kan"); box.innerHTML = "";
    var cs = Studio.d.commissions;
    if(!cs.length){
      box.innerHTML = '<p class="mini">Nenhuma comissão registrada. Clique em “nova comissão” quando fechar um trabalho.</p>';
      return;
    }
    cs.forEach(function(c, i){
      var card = document.createElement("div");
      card.className = "kan-card" + (C.isLate(c) ? " late" : "");
      card.innerHTML =
        '<div style="min-width:0">' +
          '<div class="top"><span class="who"></span>' +
            '<span class="pill ' + (c.stage||"wait") + '"></span>' +
            '<span class="pill paid-' + (c.paid||"no") + '"></span>' +
            (C.isLate(c) ? '<span class="late-flag">atrasada</span>' : '') +
          '</div>' +
          '<div class="kan-grid">' +
            '<input type="text" placeholder="@cliente" aria-label="Cliente">' +
            '<select aria-label="Tipo"></select>' +
            '<select aria-label="Etapa"><option value="wait">na fila</option><option value="sketch">sketch</option>' +
              '<option value="color">pintando</option><option value="done">entregue</option></select>' +
            '<select aria-label="Pagamento"><option value="no">não pago</option><option value="half">50% pago</option>' +
              '<option value="full">pago</option></select>' +
            '<input type="number" placeholder="valor R$" aria-label="Valor">' +
            '<input type="date" aria-label="Prazo">' +
          '</div>' +
        '</div>' +
        '<button class="iconbtn" type="button" title="remover">✕</button>';

      card.querySelector(".who").textContent = c.who || "sem nome";
      card.querySelector(".pill." + (c.stage||"wait")).textContent = STAGES[c.stage||"wait"].pt;
      card.querySelector(".pill.paid-" + (c.paid||"no")).textContent = C.PAIDLBL[c.paid||"no"];

      var ins = card.querySelectorAll("input"), sels = card.querySelectorAll("select");
      var typeSel = sels[0];
      (S().prices||[]).forEach(function(p){
        var o = document.createElement("option"); o.value = p.id; o.textContent = p.pt; typeSel.appendChild(o);
      });
      ins[0].value = c.who || ""; typeSel.value = c.type || "";
      sels[1].value = c.stage || "wait"; sels[2].value = c.paid || "no";
      ins[1].value = c.value != null ? c.value : ""; ins[2].value = c.deadline || "";

      ins[0].addEventListener("input", function(){ c.who = ins[0].value; Studio.save(); });
      typeSel.addEventListener("change", function(){ c.type = typeSel.value; Studio.save(); renderStudio(); });
      sels[1].addEventListener("change", function(){ c.stage = sels[1].value; Studio.save(); renderStudio(); touchQueue(); });
      sels[2].addEventListener("change", function(){ c.paid = sels[2].value; Studio.save(); renderStudio(); });
      ins[1].addEventListener("input", function(){ c.value = ins[1].value===""?null:+ins[1].value; Studio.save(); renderStudio(); });
      ins[2].addEventListener("input", function(){ c.deadline = ins[2].value; Studio.save(); renderStudio(); });
      card.querySelector(".iconbtn").addEventListener("click", function(){
        Studio.d.commissions.splice(i,1); Studio.save(); renderStudio(); touchQueue();
      });
      box.appendChild(card);
    });
  }
  $("#adm-kan-add").addEventListener("click", function(){
    var first = (S().prices||[])[0];
    Studio.d.commissions.push({id:"c"+Date.now().toString(36), who:"", type:first?first.id:"",
      stage:"wait", paid:"no", value:null, deadline:""});
    Studio.save(); renderStudio(); touchQueue();
  });

  /* ---------- conteúdo do site ---------- */
  function renderAdmin(){
    renderOrders(); renderStudio();
    if(!canPublish){
      $("#adm-save").disabled = true;
      $$(".adm-pane").forEach(function(p){
        var t = p.getAttribute("data-pane");
        if(t !== "pedidos" && t !== "studio" && t !== "backup") p.style.opacity = ".45";
      });
      return;
    }
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
      var isVid = /^video\//.test(f.type), fr = new FileReader();
      fr.onload = function(){
        startDraft(); draft.ych = draft.ych || {};
        draft.ych.image = fr.result; draft.ych.video = isVid;
        if(isVid) draft.ych.animated = true;
        markDirty(); renderAdmin();
      };
      fr.readAsDataURL(f); this.value = "";
    });
    yf.appendChild(yrow);
    var animBtn = yrow.querySelector("#adm-ych-anim");
    animBtn.textContent = y.animated ? "✓ animado" : "✕ estático";
    animBtn.addEventListener("click", function(){
      startDraft(); draft.ych = draft.ych || {};
      draft.ych.animated = !draft.ych.animated; markDirty(); renderAdmin();
    });

    var gb = $("#adm-gallery"); gb.innerHTML = "";
    (s.gallery||[]).forEach(function(g, i){
      var row = document.createElement("div"); row.className = "adm-row";
      row.style.gridTemplateColumns = "54px 1fr auto";
      row.innerHTML = '<input type="text" placeholder="tags: furry, feral, icon" aria-label="Tags">' +
        '<button class="iconbtn" type="button" title="remover">✕</button>';
      var thumb = document.createElement(g.video ? "video" : "img");
      thumb.src = g.src;
      if(g.video){ thumb.muted = true; thumb.loop = true; thumb.autoplay = true; thumb.playsInline = true; }
      else { thumb.alt = ""; }
      thumb.style.cssText = "width:54px;height:54px;object-fit:cover;border:2px solid var(--line);border-radius:9px";
      row.insertBefore(thumb, row.firstChild);
      var inp = row.querySelector("input");
      inp.value = (g.tags||[]).join(", ");
      inp.addEventListener("input", function(){
        startDraft();
        draft.gallery[i].tags = inp.value.split(",").map(function(t){ return t.trim().toLowerCase(); }).filter(Boolean);
        markDirty();
      });
      row.querySelector(".iconbtn").addEventListener("click", function(){
        startDraft(); draft.gallery.splice(i,1); markDirty(); renderAdmin();
      });
      gb.appendChild(row);
    });
    /* peso real da página: o que está embutido conta, o que é arquivo não */
    var g = s.gallery || [];
    var embedded = g.filter(function(x){ return /^data:/.test(x.src||""); });
    var bytes = embedded.reduce(function(n,x){ return n + (x.src||"").length; }, 0);
    var el = $("#adm-gal-size");
    el.textContent = g.length + " arquivo(s)" +
      (embedded.length ? " · " + embedded.length + " embutida(s), ~" + (bytes/1048576).toFixed(2) + " MB na página" : " · todas em arquivo");
    el.style.color = bytes > 8*1048576 ? "var(--stop)" : "";

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
  function shrinkImage(file){
    return new Promise(function(resolve, reject){
      var fr = new FileReader();
      fr.onerror = reject;
      fr.onload = function(){
        var img = new Image();
        img.onerror = reject;
        img.onload = function(){
          var scale = Math.min(1, MAX_PX / Math.max(img.width, img.height));
          var w = Math.round(img.width * scale), h = Math.round(img.height * scale);
          try{
            var cv = document.createElement("canvas");
            cv.width = w; cv.height = h;
            var cx = cv.getContext("2d");
            cx.fillStyle = "#1E1410";           /* transparência vira o fundo do site */
            cx.fillRect(0, 0, w, h);
            cx.drawImage(img, 0, 0, w, h);
            resolve({src:cv.toDataURL("image/jpeg", JPEG_Q), w:w, h:h});
          }catch(e){ resolve({src:fr.result, w:img.width, h:img.height}); }
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  $("#adm-gal-file").addEventListener("change", function(){
    var files = Array.prototype.slice.call(this.files || []);
    if(!files.length) return;
    startDraft();
    draft.gallery = draft.gallery || [];
    var msg = $("#adm-gal-size");
    msg.textContent = "preparando " + files.length + " arquivo(s)…";
    var jobs = files.map(function(file){
      if(/^video\//.test(file.type)){
        return new Promise(function(res){
          var fr = new FileReader();
          fr.onload = function(){ res({src:fr.result, video:true}); };
          fr.onerror = function(){ res(null); };
          fr.readAsDataURL(file);
        });
      }
      return shrinkImage(file).catch(function(){ return null; });
    });
    Promise.all(jobs).then(function(items){
      items.forEach(function(it){
        if(!it) return;
        var entry = {src:it.src, alt:"", tags:["furry"]};
        if(it.video) entry.video = true;
        draft.gallery.push(entry);
      });
      markDirty(); renderAdmin();
    });
    this.value = "";
  });
  function bindText(sel, key){
    $(sel).addEventListener("input", function(){
      startDraft();
      draft[key] = this.value.split("\n").map(function(l){ return l.trim(); }).filter(Boolean);
      markDirty();
    });
  }
  bindText("#adm-tos","tos"); bindText("#adm-yes","drawYes"); bindText("#adm-no","drawNo");

  /* ---------- senha ---------- */
  $("#adm-pass-save").addEventListener("click", function(){
    var a = $("#adm-pass1").value, b = $("#adm-pass2").value, msg = $("#adm-pass-msg");
    if(a.length < 4){ msg.textContent = "Use pelo menos 4 caracteres."; return; }
    if(a !== b){ msg.textContent = "As duas senhas não batem."; return; }
    if(!canPublish){ msg.textContent = "Sem acesso ao index.html, não dá para gravar a senha nova."; return; }
    startDraft(); draft.admPass = C.hashPwd(a); markDirty();
    try{ localStorage.setItem(C.PASS_KEY, draft.admPass); }catch(e){}
    $("#adm-pass1").value = ""; $("#adm-pass2").value = "";
    msg.textContent = "Senha trocada. Clique em “Publicar alterações” para valer no site.";
  });

  /* ---------- backup ---------- */
  $("#adm-export").addEventListener("click", function(){
    var s = S();
    var payload = JSON.stringify({
      version:1, exportedAt:new Date().toISOString(),
      site:{prices:s.prices, extras:s.extras, gallery:s.gallery, ych:s.ych,
            tos:s.tos, drawYes:s.drawYes, drawNo:s.drawNo,
            open:s.open, slotsTotal:s.slotsTotal},
      studio:Studio.d
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
        if(p.studio && p.studio.commissions){
          Studio.d = {commissions:p.studio.commissions||[], orders:p.studio.orders||[]};
          Studio.save();
        }
        if(p.site && canPublish){
          startDraft();
          Object.keys(p.site).forEach(function(k){ if(p.site[k] !== undefined) draft[k] = p.site[k]; });
          draft.queue = C.publicQueue();
          markDirty();
        }
        $("#adm-backup-state").textContent = "importado — confira e clique em publicar";
        renderAdmin();
      }catch(e){
        $("#adm-backup-state").textContent = "não consegui ler esse arquivo: " + e.message;
      }
    };
    fr.readAsText(f); this.value = "";
  });

  /* quem já pode editar na plataforma entra sem senha */
  Promise.resolve(window.claude && window.claude.use ? window.claude.use("user") : null)
    .then(function(user){
      if(user && typeof user.canEdit === "function" && user.canEdit()){
        platformEditor = true;
        if(state !== null && $("#adm-wrap").hidden) showPanel();
      }
    })
    .catch(function(){});

  boot();
})();
