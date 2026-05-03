type HelpListProps = {
    items: string[];
};

export function HelpList({ items }: HelpListProps) {
    return (
        <ul>
            {items.map((item) => (
                <li key={item}>{item}</li>
            ))}
        </ul>
    );
}
