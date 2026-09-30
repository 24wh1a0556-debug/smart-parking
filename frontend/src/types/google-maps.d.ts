/**
 * Minimal ambient type declarations for the Google Maps JavaScript API.
 * These cover only the subset used by ParkingMap.tsx.
 *
 * If you want full type coverage, install the official package:
 *   npm install --save-dev @types/google.maps
 * and delete this file.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

declare namespace google {
  namespace maps {
    class Map {
      constructor(mapDiv: Element, opts?: MapOptions);
      setCenter(latlng: LatLng | LatLngLiteral): void;
      setZoom(zoom: number): void;
      panTo(latlng: LatLng | LatLngLiteral): void;
      fitBounds(bounds: LatLngBounds, padding?: number | Padding): void;
    }

    class Marker {
      constructor(opts?: MarkerOptions);
      setMap(map: Map | null): void;
      setPosition(latlng: LatLng | LatLngLiteral): void;
      addListener(event: string, handler: () => void): void;
    }

    class InfoWindow {
      constructor(opts?: InfoWindowOptions);
      setContent(content: string | Element): void;
      open(map?: Map, anchor?: Marker): void;
      close(): void;
    }

    class LatLngBounds {
      constructor();
      extend(point: LatLng | LatLngLiteral): LatLngBounds;
    }

    class Size {
      constructor(width: number, height: number);
    }

    class Point {
      constructor(x: number, y: number);
    }

    interface LatLng {
      lat(): number;
      lng(): number;
    }

    interface LatLngLiteral {
      lat: number;
      lng: number;
    }

    interface MapOptions {
      center?: LatLng | LatLngLiteral;
      zoom?: number;
      mapTypeControl?: boolean;
      fullscreenControl?: boolean;
      streetViewControl?: boolean;
      zoomControlOptions?: ZoomControlOptions;
      styles?: MapTypeStyle[];
    }

    interface ZoomControlOptions {
      position?: ControlPosition;
    }

    interface MapTypeStyle {
      featureType?: string;
      elementType?: string;
      stylers?: object[];
    }

    interface MarkerOptions {
      map?: Map;
      position?: LatLng | LatLngLiteral;
      title?: string;
      icon?: string | Icon | Symbol;
      zIndex?: number;
    }

    interface Icon {
      url?: string;
      scaledSize?: Size;
      anchor?: Point;
    }

    interface Symbol {
      path: SymbolPath | string;
      scale?: number;
      fillColor?: string;
      fillOpacity?: number;
      strokeColor?: string;
      strokeWeight?: number;
    }

    interface InfoWindowOptions {
      content?: string | Element;
    }

    interface Padding {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    }

    enum SymbolPath {
      CIRCLE = 0,
      FORWARD_CLOSED_ARROW = 1,
      FORWARD_OPEN_ARROW = 2,
      BACKWARD_CLOSED_ARROW = 3,
      BACKWARD_OPEN_ARROW = 4,
    }

    enum ControlPosition {
      TOP_LEFT = 1,
      TOP_CENTER = 2,
      TOP_RIGHT = 3,
      LEFT_CENTER = 4,
      LEFT_TOP = 5,
      LEFT_BOTTOM = 6,
      RIGHT_TOP = 7,
      RIGHT_CENTER = 8,
      RIGHT_BOTTOM = 9,
      BOTTOM_LEFT = 10,
      BOTTOM_CENTER = 11,
      BOTTOM_RIGHT = 12,
    }

    // event namespace (minimal)
    const event: {
      addListener(instance: any, eventName: string, handler: (...args: any[]) => void): any;
      removeListener(listener: any): void;
    };
  }
}

interface Window {
  google: typeof google;
}
