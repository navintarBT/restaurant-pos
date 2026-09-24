import { useCallback, useEffect, useState } from "react";
import { IonPage } from "@ionic/react";
import { useHistory } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getProducts } from "../data/productRepository";
import type { Product } from "../data/types";
import ReturnForm from "../components/ReturnForm";

// "ສົ່ງຄືນ" — used to be a floating action button on ເມນູ (Products.tsx),
// opening ReturnForm as a modal. Moved here as its own sidebar page instead;
// ReturnForm itself (return + transfer tabs, with history built in) is
// unchanged, just hosted by a page instead of triggered from Products.tsx.
const Returns: React.FC = () => {
  const { shopId } = useAuth();
  const history = useHistory();
  const [products, setProducts] = useState<Product[]>([]);

  const load = useCallback(async () => {
    if (!shopId) return;
    setProducts(await getProducts(shopId));
  }, [shopId]);

  useEffect(() => { load(); }, [load]);

  return (
    <IonPage>
      {shopId && (
        <ReturnForm
          isOpen
          products={products}
          shopId={shopId}
          onDismiss={() => history.push("/tabs/products")}
          onSaved={(updated) => {
            setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          }}
        />
      )}
    </IonPage>
  );
};

export default Returns;
