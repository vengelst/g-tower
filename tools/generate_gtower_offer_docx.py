import datetime as _dt
import re as _re
import zipfile as _zipfile
from pathlib import Path
from xml.sax.saxutils import escape as _xml_escape


def _sanitize_xml_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    # Word tends to prefer tabs/spaces; normalize exotic whitespace.
    text = text.replace("\u00a0", " ")
    return _xml_escape(text)


def _make_document_xml(title: str, body_lines: list[str]) -> str:
    paragraphs: list[str] = []

    title_xml = _sanitize_xml_text(title)
    paragraphs.append(
        "\n".join(
            [
                "<w:p>",
                "  <w:pPr><w:pStyle w:val=\"Heading1\"/></w:pPr>",
                f"  <w:r><w:t>{title_xml}</w:t></w:r>",
                "</w:p>",
            ]
        )
    )

    for line in body_lines:
        # Preserve blank lines as empty paragraphs.
        line_xml = _sanitize_xml_text(line)
        paragraphs.append(
            "\n".join(
                [
                    "<w:p>",
                    f"  <w:r><w:t xml:space=\"preserve\">{line_xml}</w:t></w:r>",
                    "</w:p>",
                ]
            )
        )

    return "\n".join(
        [
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
            '<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"',
            ' xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"',
            ' xmlns:o="urn:schemas-microsoft-com:office:office"',
            ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
            ' xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"',
            ' xmlns:v="urn:schemas-microsoft-com:vml"',
            ' xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"',
            ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"',
            ' xmlns:w10="urn:schemas-microsoft-com:office:word"',
            ' xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
            ' xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"',
            ' xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"',
            ' xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"',
            ' xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"',
            ' xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"',
            ' mc:Ignorable="w14 wp14">',
            "  <w:body>",
            _re.sub(r"^", "    ", "\n".join(paragraphs), flags=_re.M),
            "    <w:sectPr>",
            "      <w:pgSz w:w=\"11906\" w:h=\"16838\"/>",
            "      <w:pgMar w:top=\"1440\" w:right=\"1440\" w:bottom=\"1440\" w:left=\"1440\" w:header=\"708\" w:footer=\"708\" w:gutter=\"0\"/>",
            "      <w:cols w:space=\"708\"/>",
            "      <w:docGrid w:linePitch=\"360\"/>",
            "    </w:sectPr>",
            "  </w:body>",
            "</w:document>",
        ]
    )


def _content_types_xml() -> str:
    return "\n".join(
        [
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
            '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
            '  <Default Extension="xml" ContentType="application/xml"/>',
            '  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>',
            '  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
            '  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>',
            "</Types>",
        ]
    )


def _rels_xml() -> str:
    return "\n".join(
        [
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
            '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>',
            '  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>',
            '  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>',
            "</Relationships>",
        ]
    )


def _docprops_core_xml(title: str) -> str:
    now = _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    title_xml = _sanitize_xml_text(title)
    return "\n".join(
        [
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
            '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"',
            ' xmlns:dc="http://purl.org/dc/elements/1.1/"',
            ' xmlns:dcterms="http://purl.org/dc/terms/"',
            ' xmlns:dcmitype="http://purl.org/dc/dcmitype/"',
            ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
            f"  <dc:title>{title_xml}</dc:title>",
            "  <dc:creator>Codex CLI</dc:creator>",
            "  <cp:lastModifiedBy>Codex CLI</cp:lastModifiedBy>",
            f'  <dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created>',
            f'  <dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified>',
            "</cp:coreProperties>",
        ]
    )


def _docprops_app_xml() -> str:
    return "\n".join(
        [
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
            '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"',
            ' xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">',
            "  <Application>Codex CLI</Application>",
            "</Properties>",
        ]
    )


def build_offer_docx(output_path: Path) -> None:
    title = "Angebot – G-Tower Plattform"
    content = """
Projekt: G-Tower Softwareplattform
Modell: 4-stufige Umsetzung

------------------------------------------------------------
Projektteam & Verantwortung
------------------------------------------------------------
Die Umsetzung erfolgt durch einen erfahrenen Full-Stack-Programmierer mit zusätzlicher Architektur- und Systemverantwortung.
Dies stellt sicher, dass sowohl Backend als auch Frontend aus einer Hand geplant, umgesetzt und langfristig wartbar bleiben.

Die Kalkulation basiert auf einem internen, marktüblichen Stundensatz von ca. 95 € für Full-Stack-Entwicklung inkl. Architekturverantwortung.

------------------------------------------------------------
Stufe 1 – Einstieg & technisches Fundament (Fixpreis)
------------------------------------------------------------
Ziel:
Kostengünstiger Einstieg mit einem sofort nutzbaren Systemkern und sauberem Architektur-Fundament.

Backend:
- Benutzer- & Rollenverwaltung (Basis-RBAC)
- Authentifizierung (Login, Token)
- Tower-Stammdaten und Status
- Basis-Ticket-System
- PostgreSQL-Datenbank
- Docker-basierte Systemarchitektur

Frontend:
- Web-Oberfläche (Desktop)
- Dashboard (Basis)
- Tower-Listenansicht
- Tower-Detailansicht (Basis)
- Lade- & Fehlerzustände

Technologien:
Backend: Node.js (TypeScript), Express.js, PostgreSQL, Docker
Frontend: React, TypeScript, Vite, REST-API

Fixpreis:
39.000 € netto
Umsetzungsdauer: ca. 6–8 Wochen

------------------------------------------------------------
Stufe 2 – Vollständige Basisplattform (Fixpreis)
------------------------------------------------------------
Zusätzliche Funktionen:

Backend:
- Erweiterte Status- & Historienlogik
- Vollständiges Ticket-System
- Dokumentenmanagement (Upload & Versionierung)
- Aggregierte API-Endpunkte
- Kartenoptimierte API-Abfragen

Frontend:
- Interaktive Karte (OpenStreetMap, Leaflet)
- Farbige Marker je Tower-Zustand
- Tower-Detailansicht mit Tabs (Details, Tickets, Dokumente)
- Filter & Suche
- Benachrichtigungen (Toasts)

Fixpreis:
55.000 € netto (abzüglich Stufe 1 bei kombinierter Beauftragung)
Gesamtdauer Stufe 1 + 2: ca. 10–12 Wochen

------------------------------------------------------------
Stufe 3 – Erweiterungen & Systemintegrationen (Budgetrahmen)
------------------------------------------------------------
- Erweiterte Status- & Eskalationslogiken
- Erweiterte Ticket-Workflows
- Historien & Auswertungen
- Erweiterte Kartenfunktionen
- Schnittstellen zu Evalink, Talos, Nxgen
- Monitoring & Fehlerbehandlung

Budgetrahmen:
35.000 € – 55.000 € netto
Umsetzung modular nach Freigabe

------------------------------------------------------------
Stufe 4 – Internationalisierung & Mobile Apps (Budgetrahmen)
------------------------------------------------------------
Internationalisierung:
- Mehrsprachiges Frontend (DE / EN / weitere EU-Sprachen)
- Benutzerabhängige Sprachwahl
- Länderspezifische Formate

Option Mobile Apps:
- Native Apps für iOS & Android
- Gemeinsame Codebasis (Flutter oder React Native)
- Nutzung der bestehenden Backend-API
- Kartenansicht auch mobil
- Offline-Caching & Push-Benachrichtigungen (optional)

Budgetrahmen:
25.000 € – 40.000 € netto

------------------------------------------------------------
Projektlogik
------------------------------------------------------------
- Stufe 1 ist verbindlich und fix
- Stufe 2–4 sind optional und budgetiert
- Jede Stufe ist eigenständig nutzbar
- Erweiterungen erfolgen nur nach Freigabe

------------------------------------------------------------
Dieses Angebot stellt eine modulare, zukunftssichere Lösung dar und kann flexibel an den tatsächlichen Bedarf angepasst werden.
""".strip(
        "\n"
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    body_lines = content.split("\n")

    with _zipfile.ZipFile(output_path, "w", compression=_zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", _content_types_xml())
        zf.writestr("_rels/.rels", _rels_xml())
        zf.writestr("docProps/core.xml", _docprops_core_xml(title))
        zf.writestr("docProps/app.xml", _docprops_app_xml())
        zf.writestr("word/document.xml", _make_document_xml(title, body_lines))


if __name__ == "__main__":
    out = Path(__file__).resolve().parents[1] / "G-Tower_Angebot_final.docx"
    build_offer_docx(out)
    print(str(out))
