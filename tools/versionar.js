/* Renova o ?v= dos arquivos próprios do site.

   Sem isso o navegador guarda CSS e JavaScript em cache e pode ficar com
   metade de cada versão — foi assim que o layout dos filtros quebrou uma
   vez: CSS novo, JavaScript antigo. Com a versão trocando, o navegador é
   obrigado a buscar os dois juntos.

   Roda sozinho pelo publicar.cmd. Para rodar à mão: node tools/versionar.js */
const fs = require("fs");
const path = require("path");

const raiz = path.join(__dirname, "..");
const versao = Date.now().toString(36);
let total = 0;

["index.html", "admin.html"].forEach(function (nome) {
  const arq = path.join(raiz, nome);
  if (!fs.existsSync(arq)) return;
  let h = fs.readFileSync(arq, "utf8");
  const antes = h;
  h = h.replace(/(href="css\/[a-z-]+\.css)(\?v=[^"]*)?"/g, '$1?v=' + versao + '"');
  h = h.replace(/(src="js\/[a-z-]+\.js)(\?v=[^"]*)?"/g,   '$1?v=' + versao + '"');
  if (h !== antes) { fs.writeFileSync(arq, h); total++; }
});

console.log("versao " + versao + " aplicada em " + total + " pagina(s)");
