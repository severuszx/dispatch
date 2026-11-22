Add-Type -AssemblyName System.Drawing
$out = Join-Path $PSScriptRoot "..\desktop\build"
New-Item -ItemType Directory -Force $out | Out-Null

function New-Frame([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)
  $bg = [System.Drawing.Color]::FromArgb(255, 21, 21, 21)
  $stroke = [System.Drawing.Color]::FromArgb(255, 74, 74, 74)
  $rail = [System.Drawing.Color]::FromArgb(255, 214, 208, 193)
  $red = [System.Drawing.Color]::FromArgb(255, 196, 81, 63)
  $green = [System.Drawing.Color]::FromArgb(255, 79, 146, 100)
  $r = [single]($size * 0.14)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc(0, 0, $r * 2, $r * 2, 180, 90)
  $path.AddArc($size - $r * 2, 0, $r * 2, $r * 2, 270, 90)
  $path.AddArc($size - $r * 2, $size - $r * 2, $r * 2, $r * 2, 0, 90)
  $path.AddArc(0, $size - $r * 2, $r * 2, $r * 2, 90, 90)
  $path.CloseFigure()
  $g.FillPath((New-Object System.Drawing.SolidBrush($bg)), $path)
  $pen = New-Object System.Drawing.Pen($stroke, [single][Math]::Max(1, $size / 128))
  $g.DrawPath($pen, $path)

  $rw = [single]($size * 0.032)
  $railPen = New-Object System.Drawing.Pen($rail, $rw)
  $railPen.StartCap = 'Round'; $railPen.EndCap = 'Round'
  $g.DrawLine($railPen, $size * 0.36, $size * 0.86, $size * 0.47, $size * 0.30)
  $g.DrawLine($railPen, $size * 0.64, $size * 0.86, $size * 0.53, $size * 0.30)
  $tiePen = New-Object System.Drawing.Pen($rail, [single][Math]::Max(1, $size * 0.012))
  foreach ($i in 0..3) {
    $t = 0.88 - $i * 0.16
    $half = 0.14 + $i * 0.035
    $g.DrawLine($tiePen, $size * (0.5 - $half), $size * $t, $size * (0.5 + $half), $size * $t)
  }

  $dot = [single]($size * 0.052)
  $g.FillEllipse((New-Object System.Drawing.SolidBrush($red)), $size * 0.33, $size * 0.14, $dot, $dot)
  $g.FillEllipse((New-Object System.Drawing.SolidBrush($green)), $size * 0.62, $size * 0.14, $dot, $dot)

  $g.Dispose()
  return $bmp
}

$sizes = 16, 32, 48, 64, 128, 256
$frames = @{}
foreach ($s in $sizes) {
  $bmp = New-Frame $s
  $frames[$s] = $bmp
  $bmp.Save((Join-Path $out "icon-$s.png"), [System.Drawing.Imaging.ImageFormat]::Png)
}
$frames[256].Save((Join-Path $out "icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)

$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ms)
$bw.Write([uint16]0); $bw.Write([uint16]1); $bw.Write([uint16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
$pngs = @{}
foreach ($s in $sizes) {
  $m = New-Object System.IO.MemoryStream
  $frames[$s].Save($m, [System.Drawing.Imaging.ImageFormat]::Png)
  $pngs[$s] = $m.ToArray()
}
foreach ($s in $sizes) {
  $data = $pngs[$s]
  $bw.Write([byte]$(if ($s -ge 256) { 0 } else { $s }))
  $bw.Write([byte]$(if ($s -ge 256) { 0 } else { $s }))
  $bw.Write([byte]0); $bw.Write([byte]0)
  $bw.Write([uint16]1); $bw.Write([uint16]32)
  $bw.Write([uint32]$data.Length)
  $bw.Write([uint32]$offset)
  $offset += $data.Length
}
foreach ($s in $sizes) { $bw.Write($pngs[$s]) }
$bw.Flush()
[IO.File]::WriteAllBytes((Join-Path $out "icon.ico"), $ms.ToArray())
foreach ($bmp in $frames.Values) { $bmp.Dispose() }
Write-Output "icon written"
