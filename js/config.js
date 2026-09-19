/* ============================================================
   config.js — endereço do banco.

   Estes dois valores são PÚBLICOS por natureza: eles ficam dentro do
   site, visíveis para qualquer visitante, e é assim que deve ser. Quem
   protege os dados são as regras (RLS) criadas no Supabase, não o
   sigilo desta chave.

   A chave "service_role" é o oposto: ela ignora todas as regras.
   NUNCA coloque a service_role aqui nem em nenhum arquivo do site.
   ============================================================ */
window.SYK_CONFIG = {
  /* URL base do projeto — sem /rest/v1/ no final: a biblioteca monta
     esse caminho sozinha, e com ele aqui as chamadas iriam para
     /rest/v1/rest/v1/ e falhariam. */
  supabaseUrl: "https://isljycktfylmbkvswapr.supabase.co",
  supabaseKey: "sb_publishable_TKnag5FZbVRohFpYqHFcNA_4Dl2xWbl"
};
