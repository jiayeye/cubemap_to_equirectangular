const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
const imagesMap = new Map();

const dom = {
  imageInputUp: document.getElementById('imageInput_up'),
  imageInputDown: document.getElementById('imageInput_down'),
  imageInputLeft: document.getElementById('imageInput_left'),
  imageInputRight: document.getElementById('imageInput_right'),
  imageInputFront: document.getElementById('imageInput_front'),
  imageInputBack: document.getElementById('imageInput_back'),

  generating: document.getElementById('generating')
};

dom.imageInputUp.addEventListener('change', () => loadImage("up"));
dom.imageInputDown.addEventListener('change', () => loadImage("down"));
dom.imageInputLeft.addEventListener('change', () => loadImage("left"));
dom.imageInputRight.addEventListener('change', () => loadImage("right"));
dom.imageInputFront.addEventListener('change', () => loadImage("front"));
dom.imageInputBack.addEventListener('change', () => loadImage("back"));


function loadImage(face) {
  let file;
  switch (face) {
    case "up": file = dom.imageInputUp.files[0];
      break;
    case "down": file = dom.imageInputDown.files[0];
      break;
    case "left": file = dom.imageInputLeft.files[0];
      break;
    case "right": file = dom.imageInputRight.files[0];
      break;
    case "front": file = dom.imageInputFront.files[0];
      break;
    case "back": file = dom.imageInputBack.files[0];
      break;
    default:
      break;
  }

  if (!file) {
    return;
  }

  const img = new Image();

  img.src = URL.createObjectURL(file);

  img.addEventListener('load', () => {
    const { width, height } = img;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0);

    const data = ctx.getImageData(0, 0, width, height);
    imagesMap.set(face, data);
    if (imagesMap.size >= 6) {
      // 显示生成状态
      dom.generating.style.visibility = 'visible';
      // 加载六面图后左融合处理
      processImages();
      // 隐藏状态
      dom.generating.style.visibility = 'hidden';
    }
  });
}

function processImages() {
  const frontData = imagesMap.get('front');
  // 设置生成图片宽高，默认宽度为六面图宽度的四倍，高度为2倍
  const resultResWidth = frontData.width * 4;
  const resultResHeight = frontData.height * 2;
  const writeData = new ImageData(resultResWidth, resultResHeight);

  for (let x = 0; x < resultResWidth; x++) {
    for (let y = 0; y < resultResHeight; y++) {
      // 转化为 UV, + 0.5为视角水平旋转180°
      let u = x / resultResWidth + 0.5;
      let v = y / resultResHeight;
      // 转化为 球坐标, 用弧度表示
      let theta = u * 2 * Math.PI;
      let phi = v * Math.PI;
      // 转化为 笛卡尔坐标系
      let cartesian_x = Math.cos(theta) * Math.sin(phi);
      let cartesian_y = Math.sin(theta) * Math.sin(phi);
      let cartesian_z = Math.cos(phi);

      // 计算朝向
      let maximum = Math.max(Math.abs(cartesian_x), Math.abs(cartesian_y), Math.abs(cartesian_z));
      let xx = cartesian_x / maximum;
      let yy = cartesian_y / maximum;
      let zz = cartesian_z / maximum;

      // 计算投影到立方体面上的坐标
      let faceCoord, face;
      if (xx == 1 || xx == -1) {
        face = xx === 1 ? 'X+' : 'X-';
        faceCoord = projectX(theta, phi, xx)
      } else if (yy == 1 || yy == -1) {
        face = yy === 1 ? 'Y+' : 'Y-';
        faceCoord = projectY(theta, phi, yy)
      } else {
        face = zz === 1 ? 'Z+' : 'Z-';
        faceCoord = projectZ(theta, phi, zz)
      }

      // 3D坐标转换为2D，最后注意y做flip
      let faceImageCoord = unit3DToUnit2D(faceCoord[0], faceCoord[1], faceCoord[2], face);

      let hitImage;
      // 填充输出图片像素
      switch (face) {
        case 'X+':
          hitImage = imagesMap.get('front');
          fillImage(writeData, hitImage, faceImageCoord, x, y);
          break;
        case 'X-':
          hitImage = imagesMap.get('back');
          fillImage(writeData, hitImage, faceImageCoord, x, y);
          break;

        case 'Y+':
          hitImage = imagesMap.get('right');
          fillImage(writeData, hitImage, faceImageCoord, x, y);
          break;
        case 'Y-':
          hitImage = imagesMap.get('left');
          fillImage(writeData, hitImage, faceImageCoord, x, y);
          break;

        case 'Z+':
          hitImage = imagesMap.get('up');
          fillImage(writeData, hitImage, faceImageCoord, x, y);
          break;

        case 'Z-':
          hitImage = imagesMap.get('down');
          fillImage(writeData, hitImage, faceImageCoord, x, y);
          break;
        default:
          break;
      }
    }
  }

  // 下载图片
  getDataURL(writeData, 'jpg')
  .then(url => download(url));
  // console.log(writeData);
}

function projectX(theta, phi, sign) {
  let ret = [];
  let x = sign * 0.5
  let rho = x / (Math.cos(theta) * Math.sin(phi));
  let y = rho * Math.sin(theta) * Math.sin(phi);
  let z = rho * Math.cos(phi);
  ret.push(x);
  ret.push(y);
  ret.push(z);
  return ret;
}

function projectY(theta, phi, sign) {
  let ret = [];
  let y = sign * 0.5
  let rho = y / (Math.sin(theta) * Math.sin(phi));
  let x = rho * Math.cos(theta) * Math.sin(phi);
  let z = rho * Math.cos(phi);
  ret.push(x);
  ret.push(y);
  ret.push(z);
  return ret;
}

function projectZ(theta, phi, sign) {
  let ret = [];
  let z = sign * 0.5
  let rho = z / Math.cos(phi);
  let x = rho * Math.cos(theta) * Math.sin(phi);
  let y = rho * Math.sin(theta) * Math.sin(phi);
  ret.push(x);
  ret.push(y);
  ret.push(z);
  return ret;
}

function unit3DToUnit2D(_x, _y, _z, faceIndex) {
  let x2D;
  let y2D;
  if (faceIndex === "X+") {
    x2D = _y + 0.5
    y2D = _z + 0.5
  }else if (faceIndex === "Y+") {
    x2D = (_x * -1) + 0.5
    y2D = _z + 0.5
  }else if (faceIndex === "X-") {
    x2D = (_y * -1) + 0.5
    y2D = _z + 0.5
  }else if (faceIndex === "Y-") {
    x2D = _x + 0.5
    y2D = _z + 0.5
  }else if (faceIndex === "Z+") {
    x2D = _y + 0.5
    y2D = (_x * -1) + 0.5
  }else {
    x2D = _y + 0.5
    y2D = _x + 0.5
  }
  // flip y
  y2D = 1 - y2D;

  return [x2D, y2D];
}

function clamp(x, min, max) {
  return Math.min(max, Math.max(x, min));
}

function fillImage(writeData, hitImage, faceImageCoord, x, y) {
  // 上下取整
  const xl = clamp(Math.floor(hitImage.width * faceImageCoord[0]), 0, hitImage.width - 1);
  const xr = clamp(Math.ceil(hitImage.width * faceImageCoord[0]), 0, hitImage.width - 1);

  // 上下取整
  const yl = clamp(Math.floor(hitImage.height * faceImageCoord[1]), 0, hitImage.height - 1);
  const yr = clamp(Math.ceil(hitImage.height * faceImageCoord[1]), 0, hitImage.height - 1);

  // 向下采样方图
  const rl = hitImage.data[yl * hitImage.width * 4 +  xl *4];
  const gl = hitImage.data[yl * hitImage.width * 4 +  xl *4 + 1];
  const bl = hitImage.data[yl * hitImage.width * 4 +  xl *4 + 2];
  const al = hitImage.data[yl * hitImage.width * 4 +  xl *4 + 3];

  // 向上采样方图
  const rr = hitImage.data[yr * hitImage.width * 4 +  xr *4];
  const gr = hitImage.data[yr * hitImage.width * 4 +  xr *4 + 1];
  const br = hitImage.data[yr * hitImage.width * 4 +  xr *4 + 2];
  const ar = hitImage.data[yr * hitImage.width * 4 +  xr *4 + 3];

  const to = 4 * (y * writeData.width + x);

  // 写入平均颜色值
  writeData.data[to] = rl * 0.5 + rr * 0.5;
  writeData.data[to + 1] = gl * 0.5 + gr * 0.5;
  writeData.data[to + 2] = bl * 0.5 + br * 0.5;
  writeData.data[to + 3] = al * 0.5 + ar * 0.5;
}

// 下载图片类型
const mimeType = {
  'jpg': 'image/jpeg',
  'png': 'image/png'
};

// to blob
function getDataURL(imgData, extension) {
  canvas.width = imgData.width;
  canvas.height = imgData.height;
  ctx.putImageData(imgData, 0, 0);
  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(URL.createObjectURL(blob)), mimeType[extension], 0.92);
  });
}

// 下载图片
function download(url) {
  // 使用获取到的blob对象创建的url
  const filePath = url // 视频的地址
  fetch(filePath).then(res => res.blob()).then(blob => {
    const a = document.createElement('a')
    document.body.appendChild(a)
    a.style.display = 'none'
    // 使用获取到的blob对象创建的url
    const url = window.URL.createObjectURL(blob)
    a.href = url
    // 指定下载的文件名
    a.download = 'panorama'
    a.click()
    document.body.removeChild(a)
    // 移除blob对象的url
    window.URL.revokeObjectURL(url)
  })
}

