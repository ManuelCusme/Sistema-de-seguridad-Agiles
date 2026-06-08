import React, { useMemo } from 'react';
import Svg, { Path } from 'react-native-svg';
import createQr from 'qrcode-generator';

const QrCodeView = ({ value, size = 210 }) => {
  const { count, pathData } = useMemo(() => {
    try {
      const trimmedValue = String(value || '').trim();
      if (!trimmedValue) {
        return { count: 0, pathData: '' };
      }

      const qr = createQr(0, 'M');
      qr.addData(trimmedValue);
      qr.make();

      const count = qr.getModuleCount();
      let pathData = '';
      for (let row = 0; row < count; row += 1) {
        for (let col = 0; col < count; col += 1) {
          if (qr.isDark(row, col)) {
            pathData += `M${col},${row}h1v1h-1z `;
          }
        }
      }

      return { count, pathData };
    } catch (error) {
      console.warn('Error al generar codigo QR:', error);
      return { count: 0, pathData: '' };
    }
  }, [value]);

  if (count === 0 || !pathData) {
    return null;
  }

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${count} ${count}`} style={{ backgroundColor: '#ffffff' }}>
      <Path d={pathData} fill="#0f172a" />
    </Svg>
  );
};

export default QrCodeView;
