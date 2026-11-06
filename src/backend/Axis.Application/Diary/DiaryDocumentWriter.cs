using System.IO.Compression;
using System.Security;
using System.Text;
using Axis.Domain;

namespace Axis.Application.Diary;

public static class DiaryDocumentWriter
{
    private const string ContentTypesXml = """
        <?xml version="1.0" encoding="UTF-8"?>
        <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
          <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
          <Default Extension="xml" ContentType="application/xml"/>
          <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
        </Types>
        """;

    private const string RelationshipsXml = """
        <?xml version="1.0" encoding="UTF-8"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
        </Relationships>
        """;

    public static byte[] Create(DateOnly day, IEnumerable<DiaryEntry> entries)
    {
        var body = new StringBuilder(Paragraph($"Axis Diary - {day:dddd, dd MMMM yyyy}", "Title"));
        foreach (var entry in entries.OrderBy(item => item.OccurredAt))
        {
            body.Append(Paragraph($"{entry.OccurredAt.LocalDateTime:HH:mm}  {entry.Title}", "Heading1"));
            if (!string.IsNullOrWhiteSpace(entry.Body)) body.Append(Paragraph(entry.Body));
            if (!string.IsNullOrWhiteSpace(entry.Tags)) body.Append(Paragraph($"Tags: {entry.Tags}", "Subtitle"));
        }

        var documentXml = $"""
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
              <w:body>
                {body}
                <w:sectPr>
                  <w:pgSz w:w="11906" w:h="16838"/>
                  <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/>
                </w:sectPr>
              </w:body>
            </w:document>
            """;

        using var output = new MemoryStream();
        using (var archive = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true))
        {
            AddTextFile(archive, "[Content_Types].xml", ContentTypesXml);
            AddTextFile(archive, "_rels/.rels", RelationshipsXml);
            AddTextFile(archive, "word/document.xml", documentXml);
        }

        return output.ToArray();
    }

    private static string Paragraph(string value, string style = "Normal")
    {
        var escapedValue = SecurityElement.Escape(value);
        return $"<w:p><w:pPr><w:pStyle w:val=\"{style}\"/></w:pPr><w:r><w:t xml:space=\"preserve\">{escapedValue}</w:t></w:r></w:p>";
    }

    private static void AddTextFile(ZipArchive archive, string name, string content)
    {
        using var writer = new StreamWriter(archive.CreateEntry(name).Open(), new UTF8Encoding(false));
        writer.Write(content);
    }
}
