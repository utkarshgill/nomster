import React from 'react';
import QRCode from 'qrcode.react';

const OfferCard = (code) => {
    return (
        <div className='hero-card'>
            <QRcode value={code} />
        </div>);
}

export default OfferCard;
