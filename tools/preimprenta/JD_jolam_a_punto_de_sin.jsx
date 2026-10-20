// JD · Cambia el jolam (U+05B9) por punto de sin (U+05C2) en las ש que no tienen punto.
// Uso: hacer clic dentro del texto (o seleccionar el marco) y ejecutar desde
//      Ventana › Utilidades › Scripts. Actúa solo sobre esa historia.
// No toca ש que ya tienen punto de shin o de sin (ej. שֹׁמֵר, שֹׂנֵא, מֹשֶׁה).
// Se deshace con un solo Cmd/Ctrl+Z.

(function () {
    if (app.documents.length === 0) { alert("No hay ningún documento abierto."); return; }
    var story;
    try { story = app.selection[0].parentStory; } catch (e) { story = null; }
    if (!story) { alert("Hacé clic dentro del texto de Sheva Berajot (o seleccioná su marco) y volvé a ejecutar."); return; }

    app.findGrepPreferences = NothingEnum.nothing;
    app.changeGrepPreferences = NothingEnum.nothing;
    // ש + marcas (sin punto de shin/sin) + jolam, sin punto de shin/sin después
    app.findGrepPreferences.findWhat =
        "ש[\\x{05B0}-\\x{05BC}]*\\x{05B9}(?![\\x{05B0}-\\x{05BD}]*[\\x{05C1}\\x{05C2}])";
    var found = story.findGrep();
    app.findGrepPreferences = NothingEnum.nothing;

    if (found.length === 0) { alert("No se encontró ninguna ש con jolam en lugar de punto de sin."); return; }
    if (!confirm("Se encontraron " + found.length + " ש con jolam en lugar de punto de sin.\n¿Cambiarlos?")) return;

    app.doScript(function () {
        for (var i = found.length - 1; i >= 0; i--) {
            var chs = found[i].characters;
            chs[chs.length - 1].contents = "ׂ";   // el último carácter de cada hallazgo es el jolam
        }
    }, ScriptLanguage.JAVASCRIPT, undefined, UndoModes.ENTIRE_SCRIPT, "JD jolam → punto de sin");

    alert(found.length + " cambiados.\nVolvé a pasar el IDML por el verificador para confirmar.");
})();
