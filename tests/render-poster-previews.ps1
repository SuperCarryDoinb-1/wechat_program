param([switch]$Ultra)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$drawingsPath = Join-Path $projectRoot 'docs/poster-check/drawings.json'
$drawings = Get-Content -LiteralPath $drawingsPath -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($drawing in $drawings) {
  $relativeTarget = if ($Ultra) { Join-Path 'docs/8k-artwork' $drawing.file } else { $drawing.file }
  $targetPath = [IO.Path]::GetFullPath((Join-Path $projectRoot $relativeTarget))
  if (-not $targetPath.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Output outside project' }
  [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($targetPath)) | Out-Null
  $renderScale = if ($Ultra) { 7680.0 / [Math]::Max($drawing.width, $drawing.height) } else { 1.0 }
  $pixelWidth = [int][Math]::Round($drawing.width * $renderScale)
  $pixelHeight = [int][Math]::Round($drawing.height * $renderScale)
  $bitmap = New-Object System.Drawing.Bitmap $pixelWidth,$pixelHeight
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.ScaleTransform([single]($pixelWidth / $drawing.width), [single]($pixelHeight / $drawing.height))
  try {
    foreach ($item in $drawing.operations) {
      $color = [Drawing.ColorTranslator]::FromHtml($item.color)
      $brush = New-Object Drawing.SolidBrush $color
      try {
        switch ($item.op) {
          'rect' { $graphics.FillRectangle($brush, [single]$item.x, [single]$item.y, [single]$item.w, [single]$item.h) }
          'stroke' {
            $pen = New-Object Drawing.Pen $color,([single]$item.thickness)
            try { $graphics.DrawRectangle($pen, [single]$item.x, [single]$item.y, [single]$item.w, [single]$item.h) } finally { $pen.Dispose() }
          }
          'circle' { $graphics.FillEllipse($brush, [single]($item.x-$item.r), [single]($item.y-$item.r), [single]($item.r*2), [single]($item.r*2)) }
          'text' {
            $font = New-Object Drawing.Font 'Microsoft YaHei',([single]$item.size),([Drawing.FontStyle]::Regular),([Drawing.GraphicsUnit]::Pixel)
            $format = [Drawing.StringFormat]::GenericTypographic.Clone()
            try { $graphics.DrawString([string]$item.text, $font, $brush, [single]$item.x, [single]$item.y, $format) } finally { $font.Dispose(); $format.Dispose() }
          }
          default { throw "Unsupported drawing operation: $($item.op)" }
        }
      } finally { $brush.Dispose() }
    }
    $bitmap.Save($targetPath, [Drawing.Imaging.ImageFormat]::Png)
  } finally { $graphics.Dispose(); $bitmap.Dispose() }
}
Write-Output "Rendered $($drawings.Count) drawings within project. Ultra=$Ultra (GDI, not WeChat screenshots)."
