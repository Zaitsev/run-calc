type HelpListProps = {
    items: string[];
};

type Segment = { header?: string; items: string[] };

function toSegments(items: string[]): Segment[] {
    return items.reduce<Segment[]>((acc, item) => {
        if (item.startsWith('## ')) {
            acc.push({ header: item.slice(3), items: [] });
        } else {
            if (acc.length === 0) acc.push({ items: [] });
            acc[acc.length - 1].items.push(item);
        }
        return acc;
    }, []);
}

export function HelpList({ items }: HelpListProps) {
    const segments = toSegments(items);
    return (
        <>
            {segments.map((seg, i) => (
                <div key={i}>
                    {seg.header && <h3 className="help-subsection-header">{seg.header}</h3>}
                    {seg.items.length > 0 && (
                        <ul>
                            {seg.items.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                    )}
                </div>
            ))}
        </>
    );
}
