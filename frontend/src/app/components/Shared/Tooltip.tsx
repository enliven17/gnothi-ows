import React from 'react';

interface TooltipProps {
    content: string;
    children: React.ReactNode;
    position?: 'top' | 'bottom';
}

const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top' }) => {
    const [isVisible, setIsVisible] = React.useState(false);

    return (
        <div
            style={{ position: 'relative', display: 'inline-flex' }}
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}
            {isVisible && (
                <div
                    style={{
                        position: 'absolute',
                        [position === 'top' ? 'bottom' : 'top']: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        [position === 'top' ? 'marginBottom' : 'marginTop']: '8px',
                        padding: '6px 10px',
                        backgroundColor: '#1f2937',
                        color: 'white',
                        fontSize: '12px',
                        borderRadius: '6px',
                        whiteSpace: 'nowrap',
                        zIndex: 100,
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                >
                    {content}
                    <div
                        style={{
                            position: 'absolute',
                            [position === 'top' ? 'top' : 'bottom']: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)' + (position === 'bottom' ? ' rotate(180deg)' : ''),
                            width: 0,
                            height: 0,
                            borderLeft: '4px solid transparent',
                            borderRight: '4px solid transparent',
                            borderTop: '4px solid #1f2937'
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default Tooltip;