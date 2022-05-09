let dataID = await menuAbsBerlangsung.sttsAbsen.data;
// dataID = [
//   {
//     pertemuan: 'Pertemuan ke-5',
//     id: 'TVRFeU9EWXpOQT09',
//     makul: 'PEMROGRAMAN GAME 2D-DWI MARYONO'
//   },
//   {
//     pertemuan: 'Pertemuan ke-4',
//     id: 'TVRFeE9EWTVNQT09',
//     makul: 'PEMROGRAMAN GAME 2D-DWI MARYONO'
//   },
//   {
//     pertemuan: 'Pertemuan ke-3',
//     id: 'TVRFeE1UQTVOZz09',
//     makul: 'PEMROGRAMAN GAME 2D-DWI MARYONO'
//   },
//   {
//     pertemuan: 'Pertemuan ke-2',
//     id: 'TVRFd01qa3dNdz09',
//     makul: 'PEMROGRAMAN GAME 2D-DWI MARYONO'
//   },
//   {
//     pertemuan: 'Pertemuan ke-1',
//     id: 'TVRBNU5URXlOQT09',
//     makul: 'PEMROGRAMAN GAME 2D-DWI MARYONO'
//   },
//   {
//     pertemuan: 'Pertemuan ke-3',
//     id: 'TVRFeE1UazRNZz09',
//     makul: 'ROGRAMAN GAME 3D-MARYONO DWI'
//   },
//   {
//     pertemuan: 'Pertemuan ke-2',
//     id: 'TVRBNU5qQTNNZz09',
//     makul: 'ROGRAMAN GAME 3D-MARYONO DWI'
//   },
//   {
//     pertemuan: 'Pertemuan ke-1',
//     id: 'TVRBNE9UQXlNQT09',
//     makul: 'ROGRAMAN GAME 3D-MARYONO DWI'
//   }
// ];

let result = dataID.reduce(function (r, a) {
      r[a.makul] = r[a.makul] || [];
      r[a.makul].push(a);
      return r;
  }, Object.create(null));

const entries = Object.entries(result);
var no = 0;
entries.forEach(([key, value]) => {
  console.log(`#${key}`);
  value.forEach(function(vals){
    no++;
    console.log(`--(${no}) ${vals.pertemuan}`);
  });
});
// output: #NAMA_MK
//         --(1) Pertemuanx ... so ons
