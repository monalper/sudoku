# Sudoku

Bu proje; HTML, CSS ve JavaScript ile yazılmış, farklı seviyelerde sudoku üreten ve skor / en yüksek skor bilgisini `localStorage` içinde saklayan bir sudoku oyunudur.

## Çalıştırma

- `index.html` dosyasını tarayıcıda açın.
- Bazı tarayıcılarda yerel dosya kısıtları nedeniyle (özellikle modül / fetch vb.) sorun yaşarsanız klasörü yerel bir sunucu ile servis edin:
  - `python -m http.server`
  - veya `npx serve`

## Özellikler

- Sudoku üretimi: Kolay / Orta / Zor / Usta
- Kontroller:
  - Klavye: `1–9` gir, `Backspace/Delete` sil, ok tuşları ile gez
  - Mobil: sayı tuş takımı ile gir, `Sil` ile temizle (numpad masaüstünde gizlidir)
- Skor: doğru doldurma + seviye çarpanı, süre ve hata cezaları ile hesaplanır
- En yüksek skor: seviye bazında `localStorage` içinde saklanır

## Tasarım

- Arkaplan: `#181617`
- Yazı: `#edece4`
- Font: Inter (Google Fonts üzerinden yüklenir)
- Gradient ve shadow kullanılmaz
