$items = Get-ChildItem "e:\mafia\assets" -Filter "*.jpg"
$i = 1
foreach ($item in $items) {
    $dest = "e:\mafia\assets\bg_$i.jpg"
    Copy-Item -Path $item.FullName -Destination $dest -Force
    Write-Host "Copied $($item.Name) -> bg_$i.jpg"
    $i++
}
