(function(){
  "use strict";
  var C = window.SykCore;
  var $ = C.$, $$ = C.$$, STAGES = C.STAGES, TAGS = C.TAGS;




  var state, draft = null, lang = "pt", cur = "BRL", filter = "all", galOrdem = "recentes";

  /* O que está no HTML é a reserva: garante a página completa no primeiro
     instante e mantém o site de pé se o banco não responder. Logo em
     seguida o conteúdo do banco entra por cima, se houver. */
  state = C.readState(document) || {open:false,slotsTotal:5,prices:[],queue:[],gallery:[]};
  function S(){ return draft || state; }

  /* ---------- idioma ---------- */
  function pick(o,a,b){ return lang === "en" ? o[b] : o[a]; }
  function applyLang(){
    $$("[data-en]").forEach(function(el){
      if(!el.hasAttribute("data-pt")) el.setAttribute("data-pt", el.innerHTML);
      el.innerHTML = el.getAttribute(lang === "en" ? "data-en" : "data-pt");
    });
    /* texto de exemplo dos campos: é atributo, não conteúdo, então
       precisa da própria troca — senão o site em inglês pede "@seuuser" */
    $$("[data-ph-en]").forEach(function(el){
      if(!el.hasAttribute("data-ph-pt")) el.setAttribute("data-ph-pt", el.placeholder || "");
      el.placeholder = el.getAttribute(lang === "en" ? "data-ph-en" : "data-ph-pt") || "";
    });
    $("#lang-btn").textContent = lang === "en" ? "PT" : "EN";
    document.documentElement.lang = lang === "en" ? "en" : "pt-BR";
    renderPrices(); renderExtras(); renderHeroPrice(); renderQueue(); renderStatus(); renderFilters(); renderGallery();
    renderTypes(); renderYch(); renderTexts(); renderEstimate();
    renderSummary(); renderMarquee(); syncYchFields();
  }
  $("#lang-btn").addEventListener("click", function(){
    lang = lang === "en" ? "pt" : "en";
    /* o idioma escolhe a moeda: quem lê em inglês vê dólar */
    cur = lang === "en" ? "USD" : "BRL";
    var fc = $("#f-cur"); if(fc) fc.value = cur;
    try{ localStorage.setItem("syk-lang", lang); }catch(e){}
    applyLang();
  });

  /* ---------- status ---------- */
  function renderStatus(){
    var s = S(), taken = (s.queue||[]).filter(function(q){return q.stage!=="done";}).length;
    var free = Math.max(0, (s.slotsTotal||0) - taken);
    var full = s.open && free === 0;
    $("#status-dot").className = "dot " + (s.open && !full ? "open" : "closed");
    $("#status-text").textContent = full
      ? (lang==="en" ? "Every slot is taken" : "Todas as vagas estão ocupadas")
      : s.open
        ? (lang==="en" ? "Commissions are open" : "Comissões abertas")
        : (lang==="en" ? "Commissions are closed right now" : "Comissões fechadas no momento");
    $("#status-detail").textContent = full
      ? (lang==="en" ? "The queue is still moving — a slot frees up as each one ships"
                     : "A fila continua andando: cada entrega libera uma vaga")
      : s.open
        ? (lang==="en" ? free + " of " + s.slotsTotal + " slots free" : free + " de " + s.slotsTotal + " vagas livres")
        : (lang==="en" ? "Follow me to hear when they reopen" : "Me segue pra saber quando reabrir");
    [["#slot-dots",true],["#hero-slots",false]].forEach(function(pair){
      var box = $(pair[0]); if(!box) return;
      box.innerHTML = "";
      for(var i=0;i<(s.slotsTotal||0);i++){
        var d = document.createElement("span");
        d.className = "slot-dot" + (i < taken ? " taken" : "");
        box.appendChild(d);
      }
    });
    var st = $("#slot-text");
    if(st) st.textContent = s.open
      ? (lang==="en" ? free + " slot(s) still open out of " + s.slotsTotal + "." : free + " vaga(s) ainda aberta(s) de " + s.slotsTotal + ".")
      : (lang==="en" ? "Closed for now, but the queue below is still moving." : "Fechado por ora, mas a fila abaixo continua andando.");
  }

  /* ---------- preços ---------- */
  function money(v){ if(v===null||v===undefined||v==="") return null;
    return cur === "USD" ? "$" + v : "R$" + v; }
  function renderPrices(){
    var box = $("#price-grid"); if(!box) return;
    box.innerHTML = "";
    (S().prices||[]).forEach(function(p){
      var card = document.createElement("article"); card.className = "price-card";
      var r = money(p.rendered[cur==="USD"?"usd":"brl"]), f = money(p.flat[cur==="USD"?"usd":"brl"]);

      /* nenhum dos dois acabamentos tem valor fechado: vira um card curto
         com uma linha de "a combinar", sem repetir a mesma frase duas vezes */
      if(!r && !f){
        card.className += " quoted";
        card.innerHTML = '<header><span></span><h3></h3></header>' +
          '<div class="tiers"><div class="quote-line"><p></p><span class="amt"></span></div></div>';
        card.querySelector("header span").textContent = lang==="en" ? "COMMISSION" : "COMISSÃO";
        card.querySelector("h3").textContent = pick(p,"pt","en");
        card.querySelector("p").textContent = lang==="en"
          ? "Quoted case by case — size, characters and detail change the price."
          : "Orçado caso a caso: tamanho, personagens e detalhe mudam o preço.";
        card.querySelector(".amt").textContent = lang==="en" ? "ask me" : "a combinar";
        box.appendChild(card);
        return;
      }

      card.innerHTML =
        '<header><span>' + (lang==="en"?"COMMISSION":"COMISSÃO") + '</span><h3></h3></header>' +
        '<div class="tiers">' +
          '<div class="tier"><div class="name">Rendered<small></small></div><div class="amt' + (r?"":" tbd") + '"></div></div>' +
          '<div class="tier"><div class="name">Flat colour<small></small></div><div class="amt' + (f?"":" tbd") + '"></div></div>' +
        '</div>';
      card.querySelector("h3").textContent = pick(p,"pt","en");
      var smalls = card.querySelectorAll("small");
      smalls[0].textContent = lang==="en" ? "with light and shading" : "com luz e sombreamento";
      smalls[1].textContent = lang==="en" ? "clean flat colours" : "cores chapadas";
      var amts = card.querySelectorAll(".amt");
      amts[0].textContent = r || (lang==="en"?"ask me":"a combinar");
      amts[1].textContent = f || (lang==="en"?"ask me":"a combinar");
      box.appendChild(card);
    });
    $$("[data-cur]").forEach(function(b){ b.setAttribute("aria-pressed", String(b.getAttribute("data-cur")===cur)); });
  }

  /* O selo do hero segue o IDIOMA, não o seletor de moeda da tabela.
     São controles separados de propósito: mexer nos preços não deve
     reescrever a chamada lá em cima. */
  function renderHeroPrice(){
    var hp = $("#hero-price"); if(!hp) return;
    var k = lang === "en" ? "usd" : "brl", cheapest = null;
    (S().prices||[]).forEach(function(p){
      var v = p.flat[k];
      if(v!==null && v!==undefined && (cheapest===null || v<cheapest)) cheapest = v;
    });
    hp.textContent = cheapest===null ? "—" : (k==="usd" ? "$" : "R$") + cheapest;
  }

  /* um único ponto que troca a moeda da tabela e mantém os dois
     controles (chips e select do formulário) sempre iguais */
  function setCur(next){
    cur = next;
    var fc = $("#f-cur"); if(fc && fc.value !== next) fc.value = next;
    renderPrices(); renderExtras(); renderHeroPrice(); renderYch(); renderEstimate(); renderSummary();
  }
  $$("[data-cur]").forEach(function(b){
    b.addEventListener("click", function(){ setCur(b.getAttribute("data-cur")); });
  });

  /* ---------- fila ---------- */
  function typeName(id){
    var p = (S().prices||[]).filter(function(x){ return x.id === id; })[0];
    return p ? pick(p,"pt","en") : (lang==="en" ? "Commission" : "Comissão");
  }
  function renderQueue(){
    var box = $("#queue-list"); if(!box) return;
    box.innerHTML = "";
    var q = S().queue || [];
    if(!q.length){
      box.innerHTML = '<div class="gal-empty">' + (lang==="en"?"Nothing in the queue right now.":"Nada na fila no momento.") + '</div>';
      return;
    }
    q.forEach(function(item, i){
      var st = STAGES[item.stage] || STAGES.wait;
      var row = document.createElement("div"); row.className = "qrow";
      row.innerHTML = '<span class="qnum">' + String(i+1).padStart(2,"0") + '</span>' +
        '<div><div class="who"></div><div class="what"></div></div>' +
        '<span class="pill ' + item.stage + '"></span>';
      /* a fila pública é anônima: posição, tipo e etapa, nunca o cliente */
      row.querySelector(".who").textContent = (lang==="en" ? "Commission " : "Comissão ") + String(i+1).padStart(2,"0");
      row.querySelector(".what").textContent = typeName(item.type);
      row.querySelector(".pill").textContent = pick(st,"pt","en");
      box.appendChild(row);
    });
  }

  /* Acréscimos entram como um card DENTRO do grid de preços, com cabeçalho
     morango em vez de amarelo: pertencem à tabela, mas não são um item que
     se compra sozinho. Roda depois de renderPrices, que limpa o grid. */
  function renderExtras(){
    var grid = $("#price-grid"); if(!grid) return;
    var old = grid.querySelector(".extras-card"); if(old) old.remove();
    var ex = S().extras || {}, L = lang === "en";
    var items = [
      [L?"Extra character":"Personagem extra", ex.character, L?"each one beyond the first":"cada um além do primeiro"],
      [L?"Simple background":"Fundo simples",  ex.bgSimple,  L?"colour, texture or pattern":"cor, textura ou padrão"],
      [L?"Detailed background":"Fundo detalhado", ex.bgDetailed, L?"scenery, props, depth":"cenário, objetos, profundidade"],
      ["NSFW", ex.nsfw, L?"on top of any price":"sobre qualquer preço"]
    ].filter(function(p){ return p[1]; });
    if(!items.length) return;

    var card = document.createElement("article");
    card.className = "price-card extras-card";
    var head = document.createElement("header");
    head.innerHTML = '<span></span><h3></h3>';
    head.querySelector("span").textContent = L ? "ADD-ONS" : "ACRÉSCIMOS";
    head.querySelector("h3").textContent = L ? "Make it yours" : "Deixe do seu jeito";
    card.appendChild(head);

    var body = document.createElement("div");
    body.className = "tiers";
    items.forEach(function(p){
      var row = document.createElement("div"); row.className = "tier";
      var name = document.createElement("div"); name.className = "name";
      name.appendChild(document.createTextNode(p[0]));
      var small = document.createElement("small"); small.textContent = p[2];
      name.appendChild(small);
      var amt = document.createElement("div"); amt.className = "amt pct";
      amt.textContent = "+" + p[1] + "%";
      row.appendChild(name); row.appendChild(amt);
      body.appendChild(row);
    });
    card.appendChild(body);
    grid.appendChild(card);
  }

  function renderYch(){
    var sec = $("#ych"); if(!sec) return;
    var y = S().ych || {};
    sec.hidden = !y.active;
    if(!y.active) return;
    $("#ych-name").textContent = pick(y,"name_pt","name_en") || y.name ||
      (lang==="en" ? "This month's base" : "Base deste mês");
    $("#ych-desc").textContent = pick(y,"desc_pt","desc_en") || y.desc || "";

    /* o YCH é vendido só em dólar: o preço não segue o seletor de moeda
       nem o idioma, e a página diz isso em vez de deixar a dúvida */
    var usdOnly = y.usdOnly !== false;
    var v = usdOnly ? y.priceUsd : (cur === "USD" ? (y.priceUsd ?? y.price) : y.price);
    $("#ych-price").textContent = (v===null||v===undefined||v==="")
      ? (lang==="en"?"ask me":"a combinar")
      : (usdOnly || cur==="USD" ? "$"+v : "R$"+v);
    var only = $("#ych-usdonly");
    only.hidden = !usdOnly;
    only.textContent = lang==="en" ? "USD only" : "somente em dólar";
    var free = Math.max(0, (y.slots||0) - (y.taken||0));
    var slotEl = $("#ych-slots");
    slotEl.textContent = free
      ? (lang==="en" ? free + " of " + (y.slots||0) + " slots left" : free + " de " + (y.slots||0) + " vagas")
      : (lang==="en" ? "all slots taken" : "vagas esgotadas");
    slotEl.className = "pill " + (free ? "sketch" : "wait");

    var tag = $("#ych-tag");
    tag.hidden = !y.animated;

    var art = $("#ych-art");
    art.innerHTML = "";
    if(y.image){
      var im = document.createElement(y.video ? "video" : "img");
      im.src = y.image;
      if(y.video){
        im.muted = true; im.loop = true; im.autoplay = true; im.playsInline = true;
        /* a base animada é decoração, não um player: sem controles, sem
           botão de picture-in-picture e sem download no menu do navegador */
        im.controls = false;
        im.disablePictureInPicture = true;
        im.setAttribute("controlslist", "nodownload noplaybackrate noremoteplayback");
      }
      else { im.alt = y.name || ""; }
      art.appendChild(im);
    } else {
      /* sem arte ainda: moldura desenhada, em vez de um buraco vazio */
      art.innerHTML = '<div class="ych-empty"><span>' +
        (y.animated ? "▶" : "✦") + '</span><p>' +
        (lang==="en" ? "Base coming soon" : "Base chegando em breve") + '</p></div>';
    }
  }

  /* ---------- galeria ---------- */
  /* Quinze etiquetas numa fileira só viram sopa. Separadas em "o que é" e
     "quem está desenhado", com rótulo, dá para achar o que se procura.
     Uma etiqueta que ninguém usou some da lista, em vez de virar um botão
     que não filtra nada. */
  function renderFilters(){
    var box = $("#filters"); if(!box) return;
    box.innerHTML = "";
    var usadas = {};
    (S().gallery || []).forEach(function(g){
      (g.tags || []).forEach(function(t){ usadas[t] = true; });
    });

    [["tipo", lang==="en" ? "Kind of work" : "Tipo de trabalho"],
     ["quem", lang==="en" ? "Who's in it"  : "Quem aparece"]].forEach(function(par){
      var doGrupo = TAGS.filter(function(t){
        return t.grupo === par[0] && (t.id === "all" || usadas[t.id]);
      });
      if(doGrupo.length <= (par[0] === "tipo" ? 1 : 0)) return;   /* só "Tudo" não é filtro */

      var linha = document.createElement("div");
      linha.className = "filter-row";
      var rotulo = document.createElement("span");
      rotulo.className = "filter-label";
      rotulo.textContent = par[1];
      linha.appendChild(rotulo);

      doGrupo.forEach(function(t){
        var b = document.createElement("button");
        b.type = "button"; b.className = "chipbtn";
        b.textContent = pick(t,"pt","en");
        b.setAttribute("aria-pressed", String(t.id === filter));
        b.addEventListener("click", function(){ filter = t.id; renderFilters(); renderGallery(); });
        linha.appendChild(b);
      });
      box.appendChild(linha);
    });

    /* ordem: só aparece quando há peças o bastante para a ordem importar */
    if((S().gallery || []).length > 3){
      var linhaOrdem = document.createElement("div");
      linhaOrdem.className = "filter-row";
      var rot = document.createElement("span");
      rot.className = "filter-label";
      rot.textContent = lang === "en" ? "Order" : "Ordem";
      linhaOrdem.appendChild(rot);
      [["recentes", lang==="en" ? "Newest first" : "Mais recentes"],
       ["antigas",  lang==="en" ? "Oldest first" : "Mais antigas"]].forEach(function(o){
        var b = document.createElement("button");
        b.type = "button"; b.className = "chipbtn";
        b.textContent = o[1];
        b.setAttribute("aria-pressed", String(o[0] === galOrdem));
        b.addEventListener("click", function(){ galOrdem = o[0]; renderFilters(); renderGallery(); });
        linhaOrdem.appendChild(b);
      });
      box.appendChild(linhaOrdem);
    }
  }
  function tagLabel(id){ var t = TAGS.filter(function(x){return x.id===id;})[0]; return t ? pick(t,"pt","en") : id; }
  function renderGallery(){
    var box = $("#gal"); if(!box) return;
    box.innerHTML = "";
    /* a galeria já vem com a mais nova na frente (o painel põe no topo);
       este botão deixa ver as antigas primeiro quando alguém quiser */
    var items = (S().gallery||[]).filter(function(g){
      return filter === "all" || (g.tags||[]).indexOf(filter) > -1;
    });
    if(galOrdem === "antigas") items = items.slice().reverse();
    if(!items.length){
      box.innerHTML = '<div class="gal-empty"><p style="font-weight:700; margin-bottom:6px">' +
        (lang==="en" ? "No pieces here yet." : "Ainda não tem nada aqui.") + '</p><p style="font-size:.9rem">' +
        (lang==="en" ? "Artwork gets added through the panel." : "As artes entram pelo painel.") + '</p></div>';
      return;
    }
    items.forEach(function(g){
      var fig = document.createElement("figure");
      var btn = document.createElement("button");
      btn.type = "button"; btn.className = "open";
      btn.setAttribute("aria-label", (lang==="en"?"Open ":"Abrir ") + (g.alt || (lang==="en"?"artwork":"arte")));
      var frame = document.createElement("div"); frame.className = "frame";
      var media;
      if(g.video){
        media = document.createElement("video");
        media.src = g.src; media.muted = true; media.loop = true;
        media.playsInline = true; media.autoplay = true;
        media.controls = false;
        media.disablePictureInPicture = true;
        media.setAttribute("controlslist", "nodownload noplaybackrate noremoteplayback");
        media.style.width = "100%"; media.style.height = "100%"; media.style.objectFit = "cover";
        var badge = document.createElement("span");
        badge.className = "play-badge"; badge.textContent = lang==="en" ? "animated" : "animada";
        frame.appendChild(badge);
      } else {
        media = document.createElement("img");
        media.src = g.src; media.alt = g.alt || ""; media.loading = "lazy";
      }
      frame.appendChild(media);
      btn.appendChild(frame);
      btn.addEventListener("click", function(){ openLightbox(g); });
      var cap = document.createElement("figcaption");
      (g.tags||[]).forEach(function(t){
        var s = document.createElement("span"); s.className = "tag"; s.textContent = tagLabel(t); cap.appendChild(s);
      });
      fig.appendChild(btn); fig.appendChild(cap); box.appendChild(fig);
    });
  }

  function openLightbox(g){
    var dlg = $("#lightbox"), holder = $("#lb-media");
    holder.innerHTML = "";
    var el;
    if(g.video){
      el = document.createElement("video");
      el.src = g.src; el.controls = true; el.autoplay = true; el.loop = true; el.playsInline = true;
    } else {
      el = document.createElement("img");
      el.src = g.src; el.alt = g.alt || "";
    }
    holder.appendChild(el);
    $("#lb-caption").textContent = (g.tags||[]).map(tagLabel).join(" · ");
    if(typeof dlg.showModal === "function") dlg.showModal();
  }
  $("#lb-close").addEventListener("click", function(){ $("#lightbox").close(); });
  $("#lightbox").addEventListener("click", function(e){ if(e.target === this) this.close(); });
  $("#lightbox").addEventListener("close", function(){ $("#lb-media").innerHTML = ""; });

  /* ---------- formulário ---------- */
  function renderTypes(){
    var sel = $("#f-type"); if(!sel) return;
    var keep = sel.value;
    sel.innerHTML = "";
    (S().prices||[]).forEach(function(p){
      var o = document.createElement("option");
      o.value = p.id; o.textContent = pick(p,"pt","en");
      sel.appendChild(o);
    });
    /* o YCH do mês também é uma comissão que dá para pedir: sem ele na
       lista, quem clicava em "pegar uma vaga" não achava o que escolher */
    var y = S().ych || {};
    if(y.active){
      var o = document.createElement("option");
      o.value = "ych";
      o.textContent = pick(y,"name_pt","name_en") || (lang==="en" ? "YCH of the month" : "YCH do mês");
      sel.appendChild(o);
    }
    if(keep) sel.value = keep;
    if(!sel.value) sel.selectedIndex = 0;
  }

  /* O YCH é uma base pronta: o preço é fechado, não tem acabamento a
     escolher nem acréscimo de fundo ou personagem. Os campos que não se
     aplicam ficam desligados, em vez de sugerir escolhas que não existem. */
  function isYch(){ return $("#f-type") && $("#f-type").value === "ych"; }
  function syncYchFields(){
    var ych = isYch();
    ["#f-finish","#f-chars","#f-cur"].forEach(function(s){
      var el = $(s); if(el) el.disabled = ych;
    });
    $$("#f-bg input").forEach(function(r){ r.disabled = ych; });
    var aviso = $("#ych-note");
    if(aviso){
      aviso.hidden = !ych;
      aviso.textContent = lang === "en"
        ? "The monthly YCH has a closed price: the base is already drawn, so there's no finish or add-on to pick."
        : "O YCH do mês tem preço fechado: a base já está desenhada, então não há acabamento nem acréscimo a escolher.";
    }
  }
  /* o YCH é vendido só em dólar, então o orçamento dele não segue
     o seletor de moeda: a função aceita a moeda do próprio item */
  function money2(v, moeda){ return ((moeda || cur) === "USD" ? "$" : "R$") + v; }
  function bgValue(){
    var el = document.querySelector('input[name="bg"]:checked');
    return el ? el.value : "none";
  }
  /* orçamento: base do tipo/acabamento + acréscimos percentuais */
  function quote(){
    var s = S();
    /* YCH: valor fechado em dólar, sem acréscimos */
    if(isYch()){
      var y = s.ych || {};
      var v = y.priceUsd;
      return {
        base: (v === null || v === undefined || v === "") ? null : v,
        lines: [],
        total: (v === null || v === undefined || v === "") ? null : v,
        label: pick(y,"name_pt","name_en") || (lang==="en" ? "YCH of the month" : "YCH do mês"),
        moeda: "USD"
      };
    }
    var p = (s.prices||[]).filter(function(x){ return x.id === $("#f-type").value; })[0];
    if(!p) return null;
    var key = cur === "USD" ? "usd" : "brl";
    var base = p[$("#f-finish").value === "flat" ? "flat" : "rendered"][key];
    if(base === null || base === undefined) return {base:null, lines:[], total:null, label:pick(p,"pt","en")};
    var ex = s.extras || {}, lines = [], total = base, L = lang === "en";
    var chars = Math.max(1, +$("#f-chars").value || 1);
    if(chars > 1 && ex.character){
      var n = chars - 1, pct = ex.character * n, v = Math.round(base * pct / 100);
      lines.push({label:(L?"+"+n+" character":"+"+n+" personagem") + (n>1?"s":""), pct:pct, value:v});
      total += v;
    }
    var bg = bgValue();
    if(bg === "simple" && ex.bgSimple){
      var v1 = Math.round(base * ex.bgSimple / 100);
      lines.push({label:L?"Simple background":"Fundo simples", pct:ex.bgSimple, value:v1}); total += v1;
    }
    if(bg === "detailed" && ex.bgDetailed){
      var v2 = Math.round(base * ex.bgDetailed / 100);
      lines.push({label:L?"Detailed background":"Fundo detalhado", pct:ex.bgDetailed, value:v2}); total += v2;
    }
    if($("#f-rating").value === "nsfw" && ex.nsfw){
      var v3 = Math.round(base * ex.nsfw / 100);
      lines.push({label:"NSFW", pct:ex.nsfw, value:v3}); total += v3;
    }
    return {base:base, lines:lines, total:Math.round(total), label:pick(p,"pt","en")};
  }

  function renderEstimate(){
    var box = $("#estimate"); if(!box) return;
    var q = quote(), L = lang === "en";
    if(!q || q.base === null){
      box.innerHTML = '<p class="eyebrow">' + (L?"Estimate":"Orçamento") + '</p>' +
        '<p style="margin-top:8px; font-size:.92rem; color:var(--cocoa-soft)">' +
        (L ? "This one is quoted case by case. Send the form and I'll give you a number."
           : "Esse aqui é orçado caso a caso. Manda o formulário que eu te passo um valor.") + '</p>';
      return;
    }
    /* o acabamento vira etiqueta, igual aos acréscimos: as linhas ficam
       com a mesma forma e o olho compara os valores sem esforço */
    var m = q.moeda;
    var html = '<p class="eyebrow">' + (L?"Live estimate":"Orçamento ao vivo") + '</p>' +
      '<div class="est-line"><span>' + q.label +
      (q.moeda ? ' <small>' + (L?"fixed price":"preço fechado") + '</small>'
               : ' <small>' + ($("#f-finish").value==="flat"?"flat":"rendered") + '</small>') +
      '</span><span>' + money2(q.base, m) + '</span></div>';
    q.lines.forEach(function(l){
      html += '<div class="est-line"><span>' + l.label + ' <small>+' + l.pct + '%</small></span>' +
        '<span>+ ' + money2(l.value, m) + '</span></div>';
    });
    html += '<div class="est-total"><span>' + (L?"Total":"Total") + '</span><strong>' + money2(q.total, m) + '</strong></div>' +
      '<p class="est-foot">' + (L
        ? "An estimate, not a closed price. I confirm it after reading your request. Half upfront, half after the sketch."
        : "É estimativa, não preço fechado. Eu confirmo depois de ler seu pedido. Metade adiantada, metade depois do sketch.") + '</p>';
    box.innerHTML = html;
  }

  function renderSummary(){
    var out = $("#summary"); if(!out) return;
    var q = quote(), L = lang === "en";
    var bgLbl = {none:L?"none":"sem fundo", simple:L?"simple":"simples", detailed:L?"detailed":"detalhado"}[bgValue()];
    /* no YCH não existe acabamento, fundo nem personagem extra a informar */
    var lines = isYch() ? [
      (L?"Hi Syk! I'd like the monthly YCH.":"Oi Syk! Queria o YCH do mês."), "",
      (L?"Name/handle: ":"Nome/@: ") + ($("#f-name").value || "—"),
      (L?"Reply on: ":"Responder em: ") + $("#f-contact").value,
      (L?"Slot: ":"Vaga: ") + (q ? q.label : "YCH"),
      (L?"Price: ":"Preço: ") + (!q || q.total===null ? (L?"to be agreed":"a combinar") : money2(q.total, "USD")),
      (L?"Rating: ":"Classificação: ") + ($("#f-rating").value==="nsfw"?"NSFW":"SFW"),
      (L?"Needed by: ":"Precisa até: ") + ($("#f-deadline").value || (L?"no rush":"sem pressa")),
      (L?"References: ":"Referências: ") + ($("#f-refs").value || "—"), "",
      (L?"My character:":"Meu personagem:"), ($("#f-desc").value || "—"), "",
      (L?"I've read and agree to your terms of service.":"Li e concordo com os seus termos de serviço.")
    ] : [
      (L?"Hi Syk! I'd like to commission you.":"Oi Syk! Queria te comissionar."), "",
      (L?"Name/handle: ":"Nome/@: ") + ($("#f-name").value || "—"),
      (L?"Reply on: ":"Responder em: ") + $("#f-contact").value,
      (L?"Type: ":"Tipo: ") + (q ? q.label : "—") + " · " + ($("#f-finish").value==="flat"?"Flat colour":"Rendered"),
      (L?"Characters: ":"Personagens: ") + $("#f-chars").value,
      (L?"Background: ":"Fundo: ") + bgLbl,
      (L?"Rating: ":"Classificação: ") + ($("#f-rating").value==="nsfw"?"NSFW":"SFW"),
      (L?"Estimate: ":"Estimativa: ") + (!q || q.total===null ? (L?"to be agreed":"a combinar") : money2(q.total)),
      (L?"Needed by: ":"Precisa até: ") + ($("#f-deadline").value || (L?"no rush":"sem pressa")),
      (L?"References: ":"Referências: ") + ($("#f-refs").value || "—"), "",
      (L?"What I'd like:":"O que eu queria:"), ($("#f-desc").value || "—"), "",
      (L?"I've read and agree to your terms of service.":"Li e concordo com os seus termos de serviço.")
    ];
    out.textContent = lines.join("\n");
  }
  ["#f-name","#f-contact","#f-type","#f-finish","#f-rating","#f-cur","#f-refs","#f-desc","#f-chars","#f-deadline"].forEach(function(sel){
    var el = $(sel); if(el) el.addEventListener("input", function(){
      if(sel === "#f-cur"){ setCur(el.value); return; }
      if(sel === "#f-type") syncYchFields();
      renderEstimate(); renderSummary();
    });
  });
  /* o botao do YCH ja escolhe o tipo: antes levava ao formulario
     com Headshot selecionado, e a vaga do mes nao aparecia */
  var ychCta = $("#ych-cta");
  if(ychCta) ychCta.addEventListener("click", function(){
    var sel = $("#f-type");
    if(sel && Array.prototype.some.call(sel.options, function(o){ return o.value === "ych"; })){
      sel.value = "ych";
      syncYchFields(); renderEstimate(); renderSummary();
    }
  });

  $("#f-bg").addEventListener("change", function(){ renderEstimate(); renderSummary(); });
  /* enviar pedido: grava no ateliê e confirma na hora */
  $("#send-btn").addEventListener("click", function(){
    var L = lang === "en";
    if(!$("#f-name").value.trim()){
      $("#f-name").focus();
      $("#f-name").style.borderColor = "var(--berry-solid)";
      setTimeout(function(){ $("#f-name").style.borderColor = ""; }, 1800);
      return;
    }
    var q = quote(), btn = this, box = $("#sent-box");
    var DB = window.SykDB;
    if(!DB || !DB.ready){
      box.hidden = false;
      box.innerHTML = '<div class="estimate" style="border-style:solid"><p style="font-weight:700">' +
        (L ? "Couldn't send from here." : "Não consegui enviar por aqui.") + '</p>' +
        '<p style="font-size:.9rem; color:var(--cocoa-soft); margin-top:6px">' +
        (L ? "Use “Copy order” and send it on Telegram or Discord."
           : "Use “Copiar pedido” e mande no Telegram ou Discord.") + '</p></div>';
      return;
    }
    btn.disabled = true;
    var was = btn.textContent;
    btn.textContent = L ? "sending…" : "enviando…";

    DB.createOrder({
      who:$("#f-name").value.trim(),
      contact:$("#f-contact").value,
      type:$("#f-type").value,
      finish:$("#f-finish").value,
      chars:+$("#f-chars").value || 1,
      bg:bgValue(),
      rating:$("#f-rating").value,
      cur:cur,
      estimate:q ? q.total : null,
      deadline:$("#f-deadline").value || null,
      refs:$("#f-refs").value,
      desc:$("#f-desc").value,
      message:$("#summary").textContent
    }).then(function(){
      box.hidden = false;
      box.innerHTML = '<div class="estimate" style="border-style:solid"><p class="eyebrow">' +
        (L?"Order sent":"Pedido enviado") + '</p><p style="font-weight:700; margin-top:8px">' +
        (L ? "It's in Syk's panel now." : "Ele já está no painel da Syk.") + '</p>' +
        '<p style="font-size:.9rem; color:var(--cocoa-soft); margin-top:6px">' +
        (L ? "She'll get back to you on the channel you picked. Want to be sure? Copy the order and send it there too."
           : "Ela te responde pelo canal que você escolheu. Quer garantir? Copie o pedido e mande lá também.") + '</p></div>';
      box.scrollIntoView({behavior:reduceMo?"auto":"smooth", block:"nearest"});
    }).catch(function(){
      box.hidden = false;
      box.innerHTML = '<div class="estimate" style="border-style:solid; border-color:var(--berry-solid)">' +
        '<p style="font-weight:700">' + (L ? "The order didn't go through." : "O pedido não foi.") + '</p>' +
        '<p style="font-size:.9rem; color:var(--cocoa-soft); margin-top:6px">' +
        (L ? "Check your connection and try again — or use “Copy order” and send it on Telegram."
           : "Confira sua conexão e tente de novo, ou use “Copiar pedido” e mande no Telegram.") + '</p></div>';
      box.scrollIntoView({behavior:reduceMo?"auto":"smooth", block:"nearest"});
    }).then(function(){
      btn.disabled = false; btn.textContent = was;
    });
  });

  /* abrir o Telegram já com a mensagem na área de transferência:
     o link abre em aba nova, então o copiar acontece antes */
  $("#tg-btn").addEventListener("click", function(){
    try{
      if(navigator.clipboard && navigator.clipboard.writeText)
        navigator.clipboard.writeText($("#summary").textContent);
    }catch(e){}
  });

  $("#copy-btn").addEventListener("click", function(){
    var txt = $("#summary").textContent;
    var done = function(){
      var c = $("#copied"); c.hidden = false;
      setTimeout(function(){ c.hidden = true; }, 2200);
    };
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt).then(done, done);
    } else {
      var ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta);
      ta.select(); try{ document.execCommand("copy"); }catch(e){} document.body.removeChild(ta); done();
    }
  });

  /* Textos: o HTML traz ToS e listas em PT+EN. Se a Syk editar pelo painel,
     a versão dela passa a valer (texto único, sem tradução automática). */
  function renderTexts(){
    var s = S();
    if(s.tos && s.tos.length){
      var ul = document.querySelector(".rules");
      if(ul){
        ul.innerHTML = "";
        s.tos.forEach(function(t){ var li = document.createElement("li"); li.textContent = t; ul.appendChild(li); });
      }
    }
    [["drawYes",".taglist.yes"],["drawNo",".taglist.no"]].forEach(function(pair){
      var arr = s[pair[0]];
      if(!arr || !arr.length) return;
      var ul = document.querySelector(pair[1]);
      if(!ul) return;
      ul.innerHTML = "";
      arr.forEach(function(t){ var li = document.createElement("li"); li.textContent = t; ul.appendChild(li); });
    });
  }

  var reduceMo = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- easter egg do nariz ---------- */
  var HONK = "assets/honk.mp3";
  (function(){
    var btn = $("#nose"); if(!btn) return;
    var sona = btn.parentNode, audio = null, busy = false;
    btn.addEventListener("click", function(e){
      e.stopPropagation();
      if(busy) return;
      busy = true;
      try{
        if(!audio){ audio = new Audio(HONK); audio.volume = .55; }
        audio.currentTime = 0;
        var p = audio.play();
        if(p && p.catch) p.catch(function(){});
      }catch(err){}

      sona.classList.remove("honk");
      void sona.offsetWidth;   /* reinicia o keyframe */
      sona.classList.add("honk");
      setTimeout(function(){ sona.classList.remove("honk"); busy = false; }, 440);

      if(reduceMo) return;
      var note = document.createElement("span");
      note.className = "honk-note"; note.textContent = "♪";
      note.setAttribute("aria-hidden","true");
      sona.appendChild(note);
      note.animate([
        {opacity:0, transform:"translate(-50%,-50%) scale(.6)"},
        {opacity:1, transform:"translate(-50%,-140%) scale(1.1)", offset:.4},
        {opacity:0, transform:"translate(-50%,-260%) scale(1)"}
      ], {duration:900, easing:"cubic-bezier(0.23,1,0.32,1)", fill:"forwards"})
      .onfinish = function(){ note.remove(); };
    });
  })();

  /* ---------- movimento ---------- */
  function renderMarquee(){
    var t = $("#mq-track"); if(!t) return;
    var L = lang === "en";
    var words = L
      ? ["Headshot","Half body","Full body","Reference sheet","Furry","Feral","Kemono","Pokémon","Kemonomimi","MLP"]
      : ["Headshot","Half body","Full body","Reference sheet","Furry","Feral","Kemono","Pokémon","Kemonomimi","MLP"];
    /* duplicado: o keyframe anda -50%, então a emenda cai no mesmo ponto */
    var half = words.map(function(w){ return "<span>" + w + "</span>"; }).join("");
    t.innerHTML = half + half;
  }

  /* entra ao rolar, mas só o que já nasce fora da tela —
     nada acima da dobra fica invisível esperando o observer */
  function setupReveal(){
    if(reduceMo || !("IntersectionObserver" in window)) return;
    var targets = $$("section .sec-head, .price-grid, .steps, .gal, .queue-wrap, .form-card, .tos-grid, .links, .ych-card, .about-grid");
    var vh = window.innerHeight || 800;
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){ en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, {rootMargin:"0px 0px -8% 0px", threshold:0.05});
    targets.forEach(function(el){
      if(el.getBoundingClientRect().top > vh * 0.92){
        el.classList.add("reveal");
        /* índice por filho alimenta o transition-delay do stagger */
        Array.prototype.forEach.call(el.children, function(c, i){
          c.style.setProperty("--i", Math.min(i, 8));
        });
        io.observe(el);
      }
    });
  }

  /* sementinhas soltas boiando no fundo das faixas */
  /* Sementinhas soltas no fundo das faixas. A quantidade acompanha a
     altura da seção — uma faixa curta com 18 sementes viraria sujeira,
     e uma longa com 5 fica vazia. Tamanho, giro e transparência variam
     para não parecerem carimbadas. */
  function seedfall(){
    if(reduceMo) return;
    $$("section.cream, section.ground").forEach(function(sec, si){
      var layer = document.createElement("div");
      layer.className = "seedfall"; layer.setAttribute("aria-hidden","true");

      var altura = sec.offsetHeight || 600;
      /* subiu um pouco para cobrir a textura fixa que saiu */
      var quantas = Math.max(28, Math.min(84, Math.round(altura / 28)));

      for(var i = 0; i < quantas; i++){
        var s = document.createElement("i");
        /* números primos diferentes espalham sem alinhar em fileira */
        s.style.left = (2 + ((i * 37 + si * 17) % 95)) + "%";
        s.style.top  = (3 + ((i * 53 + si * 29) % 93)) + "%";
        /* todas do mesmo tamanho; o que varia é o caminho e o compasso */
        s.style.setProperty("--giro", (((i * 41 + si * 11) % 90) - 45) + "deg");
        s.style.setProperty("--sobe", (11 + (i % 5) * 4) + "px");
        s.style.setProperty("--lado", (((i % 3) - 1) * 7) + "px");
        s.style.opacity = (0.26 + ((i * 3) % 4) * 0.06).toFixed(2);
        s.style.animationDelay = (-(i * 0.6 + si * 0.7)).toFixed(1) + "s";
        s.style.animationDuration = (5.5 + (i % 6) * 0.9) + "s";
        layer.appendChild(s);
      }
      sec.insertBefore(layer, sec.firstChild);
    });
  }

  /* cursor da casa */
  document.documentElement.setAttribute("data-cursor", "on");

  /* rastro de pegadinhas: uma pata a cada ~64px percorridos, alternando
     esquerda/direita fora do eixo do movimento, girada pro lado que anda.
     WAAPI em transform/opacity, no máximo 14 vivas, tudo pointer-events:none. */
  function pawTrail(){
    var fine = window.matchMedia && window.matchMedia("(hover:hover) and (pointer:fine)").matches;
    if(!fine || reduceMo) return;

    var layer = document.createElement("div");
    layer.className = "paw-layer";
    layer.setAttribute("aria-hidden", "true");
    document.body.appendChild(layer);

    var PAW = "<svg viewBox='0 0 28 28' width='22' height='22'>" +
      "<ellipse cx='14' cy='18.5' rx='6.4' ry='5.2' fill='currentColor'/>" +
      "<ellipse cx='6.9' cy='12' rx='2.6' ry='3.2' fill='currentColor'/>" +
      "<ellipse cx='11.7' cy='8.7' rx='2.6' ry='3.4' fill='currentColor'/>" +
      "<ellipse cx='17' cy='8.9' rx='2.6' ry='3.3' fill='currentColor'/>" +
      "<ellipse cx='21.5' cy='12.6' rx='2.5' ry='3' fill='currentColor'/></svg>";

    var lastX = null, lastY = null, dist = 0, side = 1, live = 0;
    var STEP = 64, MAX = 14;

    window.addEventListener("mousemove", function(e){
      if(lastX === null){ lastX = e.clientX; lastY = e.clientY; return; }
      var dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      dist += Math.sqrt(dx*dx + dy*dy);
      if(dist < STEP || live >= MAX) return;
      dist = 0;
      side = -side;

      var ang = Math.atan2(dy, dx);
      /* desloca a pegada perpendicular ao movimento, alternando os lados */
      var ox = Math.cos(ang + Math.PI/2) * 9 * side;
      var oy = Math.sin(ang + Math.PI/2) * 9 * side;

      var paw = document.createElement("i");
      paw.className = "paw";
      paw.innerHTML = PAW;
      paw.style.left = (e.clientX + ox) + "px";
      paw.style.top  = (e.clientY + oy) + "px";
      layer.appendChild(paw);
      live++;

      var spin = (ang * 180 / Math.PI) + 90;
      var anim = paw.animate([
        {opacity:0, transform:"translate(-50%,-50%) rotate(" + spin + "deg) scale(.55)"},
        {opacity:.85, transform:"translate(-50%,-50%) rotate(" + spin + "deg) scale(1)", offset:.18},
        {opacity:0, transform:"translate(-50%,-50%) rotate(" + spin + "deg) scale(.92)"}
      ], {duration:1150, easing:"cubic-bezier(0.23,1,0.32,1)", fill:"forwards"});
      anim.onfinish = function(){ paw.remove(); live--; };
    }, {passive:true});

    /* carimbo no clique: a pata bate, um anel de onda abre em volta */
    window.addEventListener("pointerdown", function(e){
      if(e.pointerType && e.pointerType !== "mouse") return;

      var ring = document.createElement("i");
      ring.className = "paw-ring";
      ring.style.left = e.clientX + "px";
      ring.style.top  = e.clientY + "px";
      layer.appendChild(ring);
      ring.animate([
        {opacity:.7, transform:"translate(-50%,-50%) scale(.3)"},
        {opacity:0,  transform:"translate(-50%,-50%) scale(1)"}
      ], {duration:520, easing:"cubic-bezier(0.23,1,0.32,1)", fill:"forwards"})
      .onfinish = function(){ ring.remove(); };

      var stamp = document.createElement("i");
      stamp.className = "paw paw-stamp";
      stamp.innerHTML = PAW;
      stamp.style.left = e.clientX + "px";
      stamp.style.top  = e.clientY + "px";
      layer.appendChild(stamp);
      var tilt = (Math.random() * 24 - 12).toFixed(1);
      stamp.animate([
        {opacity:0,   transform:"translate(-50%,-50%) rotate(" + tilt + "deg) scale(1.5)"},
        {opacity:.95, transform:"translate(-50%,-50%) rotate(" + tilt + "deg) scale(.86)", offset:.3},
        {opacity:.9,  transform:"translate(-50%,-50%) rotate(" + tilt + "deg) scale(1)",   offset:.45},
        {opacity:0,   transform:"translate(-50%,-50%) rotate(" + tilt + "deg) scale(1.06)"}
      ], {duration:620, easing:"cubic-bezier(0.23,1,0.32,1)", fill:"forwards"})
      .onfinish = function(){ stamp.remove(); };
    }, {passive:true});
  }

  /* ---------- boot ---------- */
  try{
    var sl = localStorage.getItem("syk-lang"); if(sl) lang = sl;
  }catch(e){}
  /* moeda acompanha o idioma salvo */
  cur = lang === "en" ? "USD" : "BRL";
  if($("#f-cur")) $("#f-cur").value = cur;
  renderStatus(); renderPrices(); renderExtras(); renderHeroPrice(); renderQueue(); renderFilters(); renderGallery();
  renderTypes(); renderYch(); renderTexts(); renderEstimate();
  renderSummary(); renderMarquee(); syncYchFields();
  if(lang === "en") applyLang();
  setupReveal(); seedfall(); pawTrail();

  /* ---------- conteúdo ao vivo ----------
     Busca o que está no banco e redesenha. Se falhar (sem internet, banco
     fora do ar), a página continua exatamente como está — por isso nada
     aqui é obrigatório para o site funcionar. */
  var DB = window.SykDB;
  if(DB && DB.ready){
    DB.loadContent().then(function(fresh){
      if(!fresh || !Object.keys(fresh).length) return;
      state = fresh;
      renderPrices(); renderExtras(); renderHeroPrice(); renderStatus();
      renderFilters(); renderGallery(); renderTypes(); renderYch();
      renderTexts(); renderEstimate(); renderSummary();
    }).catch(function(){});

    DB.publicQueue().then(function(q){
      if(!q) return;
      state.queue = q;
      renderQueue(); renderStatus();
    }).catch(function(){});
  }

  /* quem já tem permissão de edição na plataforma não precisa de senha */
  Promise.resolve(window.claude && window.claude.use ? window.claude.use("user") : null)
    .then(function(user){
      if(user && typeof user.canEdit === "function" && user.canEdit()) platformEditor = true;
    })
    .catch(function(){});
})();
