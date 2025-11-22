import { useEffect, useRef } from 'react';
import { Box } from '@chakra-ui/react';

const AttendanceMap = ({ headquarters, checkIns }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    // Dynamically load Leaflet CSS and JS
    const loadLeaflet = async () => {
      // Load CSS
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
        link.crossOrigin = '';
        document.head.appendChild(link);
      }

      // Load JS
      if (!window.L) {
        await new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
          script.crossOrigin = '';
          script.onload = resolve;
          document.head.appendChild(script);
        });
      }

      if (window.L && mapRef.current && !mapInstanceRef.current && headquarters) {
        // Initialize map centered on headquarters with higher zoom for detail
        const map = window.L.map(mapRef.current, {
          zoomControl: true,
          scrollWheelZoom: true,
          dragging: true
        }).setView(
          [headquarters.latitude, headquarters.longitude],
          17 // High zoom for clear building details
        );

        // Use Esri World Imagery for satellite view with details
        const satelliteLayer = window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Tiles &copy; Esri',
          maxZoom: 20
        });

        // Add labels layer on top of satellite for street names and building labels
        const labelsLayer = window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Labels &copy; Esri',
          maxZoom: 20
        });

        // Add both layers
        satelliteLayer.addTo(map);
        labelsLayer.addTo(map);
        
        mapInstanceRef.current = map;

        mapInstanceRef.current = map;

        // Add headquarters marker (Large, prominent red pin for university)
        const hqIcon = window.L.divIcon({
          className: 'custom-marker-hq',
          html: `
            <div style="position: relative;">
              <svg width="50" height="68" viewBox="0 0 40 54" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4));">
                <path d="M20 0C8.954 0 0 8.954 0 20c0 14.5 20 34 20 34s20-19.5 20-34c0-11.046-8.954-20-20-20z" fill="#EA4335"/>
                <circle cx="20" cy="20" r="8" fill="white"/>
                <circle cx="20" cy="20" r="4" fill="#EA4335"/>
              </svg>
              <div style="
                position: absolute;
                top: -30px;
                left: 50%;
                transform: translateX(-50%);
                background: #EA4335;
                color: white;
                padding: 4px 12px;
                border-radius: 4px;
                font-weight: bold;
                font-size: 12px;
                white-space: nowrap;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              ">
                🎓 الجامعة الأردنية
              </div>
            </div>
          `,
          iconSize: [50, 68],
          iconAnchor: [25, 68],
          popupAnchor: [0, -68]
        });

        const hqMarker = window.L.marker([headquarters.latitude, headquarters.longitude], {
          icon: hqIcon
        }).addTo(map);

        hqMarker.bindPopup(`
          <div style="min-width: 240px; font-family: 'Segoe UI', Arial, sans-serif;">
            <div style="padding: 12px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="font-size: 24px;">🎓</span>
                <strong style="font-size: 17px; color: #1a1a1a;">الجامعة الأردنية</strong>
              </div>
              <p style="margin: 6px 0; color: #666; font-size: 14px; line-height: 1.5;">
                📍 ${headquarters.address}
              </p>
              <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e0e0e0;">
                <span style="background: #EA4335; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 500;">
                  المقر الرئيسي للشركة
                </span>
              </div>
            </div>
          </div>
        `, {
          className: 'google-style-popup',
          maxWidth: 280
        });

        // Don't add employee markers - we'll show them in a list below the map
      }
    };

    loadLeaflet();

    return () => {
      // Cleanup
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [headquarters, checkIns]);

  return (
    <Box position="relative">
      <Box
        ref={mapRef}
        width="100%"
        height="400px"
        borderRadius="md"
        overflow="hidden"
        border="1px solid"
        borderColor="gray.200"
        boxShadow="sm"
      />
      <style>{`
        .leaflet-container {
          font-family: 'Segoe UI', 'Roboto', Arial, sans-serif;
          background: #e5e3df;
        }
        .custom-marker-hq {
          background: transparent;
          border: none;
          z-index: 1000 !important;
        }
        .google-style-popup .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 3px 14px rgba(0,0,0,0.4);
          padding: 0;
          font-family: 'Segoe UI', 'Roboto', Arial, sans-serif;
        }
        .google-style-popup .leaflet-popup-content {
          margin: 0;
          line-height: 1.5;
        }
        .google-style-popup .leaflet-popup-tip {
          background: white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .leaflet-control-attribution {
          font-size: 9px;
          background: rgba(255, 255, 255, 0.7);
          padding: 2px 5px;
        }
        .leaflet-control-zoom {
          border: none !important;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
        .leaflet-control-zoom a {
          width: 34px !important;
          height: 34px !important;
          line-height: 34px !important;
          font-size: 20px !important;
          background: white !important;
          color: #666 !important;
        }
        .leaflet-control-zoom a:hover {
          background: #f5f5f5 !important;
          color: #333 !important;
        }
      `}</style>
    </Box>
  );
};

export default AttendanceMap;

