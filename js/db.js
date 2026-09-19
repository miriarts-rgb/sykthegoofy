/* ============================================================
   db.js — conversa com o Supabase.

   Tudo que toca o banco passa por aqui, para o resto do site não
   precisar saber que existe um banco. Carregue depois de config.js
   e da biblioteca do Supabase.

   Nada aqui confia no navegador: quem decide o que pode ser lido ou
   escrito são as regras (RLS) no servidor. Se alguém abrir o console e
   pedir a lista de pedidos sem estar logado, o banco devolve vazio.
   ============================================================ */
window.SykDB = (function(){
  "use strict";

  var cfg = window.SYK_CONFIG || {};
  var ready = !!(window.supabase && cfg.supabaseUrl &&
                 cfg.supabaseUrl.indexOf("COLE_AQUI") < 0);
  var sb = ready ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey) : null;

  function offline(){ return Promise.reject(new Error("banco não configurado")); }

  /* ---------- conteúdo do site ---------- */
  function loadContent(){
    if(!sb) return offline();
    return sb.from("site_content").select("data").eq("id", 1).single()
      .then(function(r){
        if(r.error) throw r.error;
        var got = (r.data && r.data.data) || null;
        return got && window.SykCore ? window.SykCore.withCleanTags(got) : got;
      });
  }
  function saveContent(data){
    if(!sb) return offline();
    return sb.from("site_content")
      .update({data:data, updated_at:new Date().toISOString()})
      .eq("id", 1)
      .then(function(r){ if(r.error) throw r.error; return true; });
  }

  /* ---------- fila pública ----------
     O visitante só enxerga type e stage: as outras colunas são
     recusadas pelo banco. A posição é contada aqui mesmo. */
  function publicQueue(){
    if(!sb) return Promise.resolve([]);
    return sb.from("commissions")
      .select("type,stage,created_at")
      .neq("stage", "done")
      .order("created_at", {ascending:true})
      .then(function(r){
        if(r.error) return [];
        return (r.data||[]).map(function(c){ return {type:c.type, stage:c.stage}; });
      });
  }

  /* ---------- pedidos ---------- */
  function createOrder(o){
    if(!sb) return offline();
    return sb.from("orders").insert([{
      status:"novo",
      who:o.who, contact:o.contact, type:o.type, finish:o.finish,
      chars:o.chars, bg:o.bg, rating:o.rating, cur:o.cur,
      estimate:o.estimate, deadline:o.deadline || null,
      refs:o.refs, descricao:o.desc, message:o.message
    }]).then(function(r){ if(r.error) throw r.error; return true; });
  }
  function listOrders(){
    if(!sb) return Promise.resolve([]);
    return sb.from("orders").select("*").order("created_at", {ascending:false})
      .then(function(r){ return r.error ? [] : (r.data||[]); });
  }
  function setOrderStatus(id, status){
    if(!sb) return offline();
    return sb.from("orders").update({status:status}).eq("id", id)
      .then(function(r){ if(r.error) throw r.error; return true; });
  }
  function deleteOrder(id){
    if(!sb) return offline();
    return sb.from("orders").delete().eq("id", id)
      .then(function(r){ if(r.error) throw r.error; return true; });
  }

  /* ---------- ateliê ---------- */
  function listCommissions(){
    if(!sb) return Promise.resolve([]);
    return sb.from("commissions").select("*").order("created_at", {ascending:true})
      .then(function(r){ return r.error ? [] : (r.data||[]); });
  }
  function addCommission(c){
    if(!sb) return offline();
    return sb.from("commissions").insert([c]).select().single()
      .then(function(r){ if(r.error) throw r.error; return r.data; });
  }
  function updateCommission(id, patch){
    if(!sb) return offline();
    return sb.from("commissions").update(patch).eq("id", id)
      .then(function(r){ if(r.error) throw r.error; return true; });
  }
  function deleteCommission(id){
    if(!sb) return offline();
    return sb.from("commissions").delete().eq("id", id)
      .then(function(r){ if(r.error) throw r.error; return true; });
  }

  /* ---------- arquivos da galeria ----------
     A arte vai para o armazenamento e o banco guarda só o endereço.
     Antes a imagem virava texto dentro do próprio registro, o que
     fazia cada visitante baixar a galeria inteira para abrir a página. */
  var BUCKET = "galeria";

  function uploadArt(blob, ext){
    if(!sb) return offline();
    var name = Date.now().toString(36) + "-" +
               Math.random().toString(36).slice(2, 8) + "." + (ext || "jpg");
    return sb.storage.from(BUCKET)
      .upload(name, blob, {cacheControl:"31536000", upsert:false})
      .then(function(r){
        if(r.error){
          /* o Supabase devolve mensagens que não dizem o que houve
             ("statement timeout" quando o balde nem existe): traduz para
             algo que aponte o que fazer */
          var m = (r.error.message || "") + " " + (r.error.error || "");
          if(/not found|NoSuchBucket|timeout/i.test(m))
            throw new Error("o armazenamento não está criado — rode o supabase/storage.sql");
          if(/exceeded the maximum allowed size|payload too large/i.test(m))
            throw new Error("arquivo grande demais (máx. 8 MB)");
          if(/mime type|not allowed/i.test(m))
            throw new Error("tipo de arquivo não aceito — use imagem ou mp4/webm");
          if(/row-level security|Unauthorized|401/i.test(m))
            throw new Error("sem permissão para enviar: refaça o login");
          throw r.error;
        }
        var pub = sb.storage.from(BUCKET).getPublicUrl(name);
        return {path:name, url:pub.data.publicUrl};
      });
  }
  function deleteArt(path){
    if(!sb || !path) return Promise.resolve();
    return sb.storage.from(BUCKET).remove([path]).then(function(){ return true; })
      .catch(function(){ return false; });   /* arquivo já sumido não é erro */
  }

  /* ---------- login ---------- */
  function signIn(email, password){
    if(!sb) return offline();
    return sb.auth.signInWithPassword({email:email, password:password})
      .then(function(r){ if(r.error) throw r.error; return r.data.user; });
  }
  function signOut(){ return sb ? sb.auth.signOut() : Promise.resolve(); }
  function currentUser(){
    if(!sb) return Promise.resolve(null);
    return sb.auth.getUser().then(function(r){ return (r.data && r.data.user) || null; })
      .catch(function(){ return null; });
  }

  return {
    ready:ready,
    loadContent:loadContent, saveContent:saveContent, publicQueue:publicQueue,
    uploadArt:uploadArt, deleteArt:deleteArt,
    createOrder:createOrder, listOrders:listOrders,
    setOrderStatus:setOrderStatus, deleteOrder:deleteOrder,
    listCommissions:listCommissions, addCommission:addCommission,
    updateCommission:updateCommission, deleteCommission:deleteCommission,
    signIn:signIn, signOut:signOut, currentUser:currentUser
  };
})();
