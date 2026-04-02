import React from 'react';

interface GeckoWidgetProps {
    coinId: string;
    mini?: boolean;
}

const GeckoWidget: React.FC<GeckoWidgetProps> = ({ coinId, mini = false }) => {
    const [ready, setReady] = React.useState(false);

    React.useEffect(() => {
        if (typeof window === 'undefined') return;

        // Custom element already registered
        if (customElements.get('gecko-coin-price-chart-widget')) {
            setReady(true);
            return;
        }

        // Poll until script defines the custom element (loaded async in layout.tsx)
        const id = setInterval(() => {
            if (customElements.get('gecko-coin-price-chart-widget')) {
                setReady(true);
                clearInterval(id);
            }
        }, 150);

        return () => clearInterval(id);
    }, []);

    if (!ready) return <div style={{ width: '100%', height: '100%' }} />;

    // Hack for TS — JSX doesn't know about custom elements
    const Widget = 'gecko-coin-price-chart-widget' as unknown as React.ElementType;

    if (mini) {
        return (
            <div style={{ width: '200%', height: '200%', transform: 'scale(0.5)', transformOrigin: 'top left' }}>
                <Widget
                    locale="en"
                    outlined="true"
                    coin-id={coinId}
                    initial-currency="usd"
                    style={{ width: '100%', height: '100%' }}
                ></Widget>
            </div>
        );
    }

    return (
        <Widget
            locale="en"
            outlined="true"
            coin-id={coinId}
            initial-currency="usd"
            style={{ width: '100%', height: '100%' }}
        ></Widget>
    );
};

export default GeckoWidget;
