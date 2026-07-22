<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
<xsl:output method="html" encoding="UTF-8" indent="yes"/>
<xsl:template match="/rss/channel">
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title><xsl:value-of select="title"/></title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 2.5rem auto; padding: 0 1.25rem; color: #181a1f; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    p.desc { color: #666d7c; margin-top: 0; }
    p.hint { background: #ececef; border-radius: 8px; padding: 0.75rem 1rem; font-size: 0.9rem; }
    ul { list-style: none; padding: 0; }
    li { padding: 0.85rem 0; border-bottom: 1px solid #e4e4e7; }
    li a { color: #181a1f; font-weight: 600; text-decoration: none; }
    li a:hover { text-decoration: underline; }
    li span { display: block; color: #666d7c; font-size: 0.85rem; margin-top: 0.15rem; }
  </style>
</head>
<body>
  <h1><xsl:value-of select="title"/></h1>
  <p class="desc"><xsl:value-of select="description"/></p>
  <p class="hint">This is an RSS feed — paste this page's URL into a feed reader (e.g. Feedly) to subscribe. Showing the <xsl:value-of select="count(item)"/> most recent listings below.</p>
  <ul>
    <xsl:for-each select="item">
      <li>
        <a href="{link}"><xsl:value-of select="title"/></a>
        <span><xsl:value-of select="description"/> — <xsl:value-of select="pubDate"/></span>
      </li>
    </xsl:for-each>
  </ul>
</body>
</html>
</xsl:template>
</xsl:stylesheet>
